import { XMLParser } from "fast-xml-parser";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import type { VehicleResult } from "./types";

const REGCHECK_URL = "https://www.regcheck.org.uk/api/reg.asmx/Check";
const REGCHECK_CREDITS_URL = "https://www.regcheck.org.uk/ajax/getcredits.aspx";

export function cleanRegistration(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function findOrVerifyVehicle(value: string): Promise<{
  vehicle: VehicleResult;
  origin: "shared-verified-cache" | "provider";
}> {
  const registration = cleanRegistration(value);
  if (!/^[A-Z0-9]{2,8}$/.test(registration)) {
    throw new VehicleLookupError("Enter a valid UK registration number.", 400, "INVALID_REGISTRATION");
  }

  const database = (await connectToDatabase()).connection;

  // Cuvva and Tempify now use this one verified vehicle registry. Manual rows
  // are ignored unless a successful RegCheck payload has upgraded the record.
  let cached: {
    _id: Types.ObjectId;
    regCheckData?: Record<string, unknown>;
    verifiedAt?: Date;
    updatedAt?: Date;
    vehicleIdentificationNumber?: string;
  } | null;
  try {
    cached = await database
      .collection<{
        _id: Types.ObjectId;
        regCheckData?: Record<string, unknown>;
        verifiedAt?: Date;
        updatedAt?: Date;
        vehicleIdentificationNumber?: string;
      }>("vehicles")
      .findOne({
        registration,
        lookupSource: "regcheck",
        regCheckData: { $exists: true, $type: "object" },
      });
  } catch (error) {
    console.error("[Vehicle cache] shared vehicle collection is unavailable", error);
    throw new VehicleLookupError(
      "The verified vehicle cache is temporarily unavailable. Please try again.",
      503,
      "VEHICLE_DATABASE_UNAVAILABLE",
    );
  }

  if (cached?.regCheckData && Object.keys(cached.regCheckData).length > 0) {
    const normalized = normalizeProviderVehicle(cached.regCheckData, registration);
    return {
      vehicle: presentVehicle({
        ...normalized,
        _id: cached._id,
        vehicleIdentificationNumber:
          normalized.vehicleIdentificationNumber || cached.vehicleIdentificationNumber,
        verifiedAt: cached.verifiedAt || cached.updatedAt || new Date(),
      }),
      origin: "shared-verified-cache",
    };
  }

  // Validate shared-record ownership before spending a RegCheck credit.
  const ownerId = parseSharedIntegrationOwnerId();
  const integrationOwner = await database.collection("users").findOne(
    { _id: ownerId, role: "Super Admin", status: "Active" },
    { projection: { _id: 1 } },
  );
  if (!integrationOwner) {
    throw new VehicleLookupError(
      "Shared vehicle storage is not configured with an active Cuvva Super Admin. Please contact support.",
      503,
      "SHARED_VEHICLE_OWNER_NOT_CONFIGURED",
    );
  }
  const raw = await requestRegCheck(registration);
  const normalized = normalizeProviderVehicle(raw, registration);
  const verifiedAt = new Date();
  let sharedVehicleId: Types.ObjectId | undefined;

  try {
    const vehicles = database.collection("vehicles");
    const update = buildSharedVerifiedVehicleUpdate(normalized, raw, ownerId, verifiedAt);
    await vehicles.updateOne({ registration }, update, { upsert: true });
    const saved = await vehicles.findOne(
      { registration },
      { projection: { _id: 1 } },
    );
    sharedVehicleId = saved?._id;
  } catch (error) {
    console.error("[Vehicle cache] could not save verified shared vehicle", {
      registration,
      error: error instanceof Error ? error.message : "Unknown database error",
    });
    throw new VehicleLookupError(
      "The vehicle was verified but could not be safely saved. Please try again.",
      503,
      "VEHICLE_CACHE_WRITE_FAILED",
    );
  }

  return {
    vehicle: presentVehicle({ ...normalized, _id: sharedVehicleId, verifiedAt }),
    origin: "provider",
  };
}

async function requestRegCheck(registration: string) {
  const usernames = String(
    process.env.REGCHECK_USERNAMES || process.env.REGCHECK_USERNAME || "",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!usernames.length) {
    throw new VehicleLookupError(
      "Vehicle lookup is not configured yet. Add REGCHECK_USERNAMES to the server environment.",
      503,
      "LOOKUP_NOT_CONFIGURED",
    );
  }

  let networkFailures = 0;
  let exhaustedAccounts = 0;
  let unavailableAccounts = 0;
  let plateNotFound = false;

  for (const [accountIndex, username] of usernames.entries()) {
    const query = new URLSearchParams({
      RegistrationNumber: registration,
      username,
    });

    const response = await fetch(`${REGCHECK_URL}?${query}`, {
      headers: { Accept: "application/xml, text/xml, */*" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    }).catch((error) => {
      networkFailures += 1;
      console.warn("[RegCheck] request failed", {
        account: accountIndex + 1,
        error: error instanceof Error ? error.message : "Network error",
      });
      return null;
    });

    if (!response) continue;

    if (response.ok) {
      const text = await response.text();
      try {
        const parsed = new XMLParser({
          ignoreAttributes: false,
          parseTagValue: false,
        }).parse(text);
        const jsonText = findVehicleJson(parsed);
        if (!jsonText) throw new Error("vehicleJson was missing");
        const raw =
          typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
        if (!raw || typeof raw !== "object") {
          throw new Error("invalid provider payload");
        }
        return raw as Record<string, unknown>;
      } catch (error) {
        console.error("[RegCheck] response parsing failed", {
          account: accountIndex + 1,
          error: error instanceof Error ? error.message : "Parse error",
        });
        throw new VehicleLookupError(
          "The vehicle provider returned an invalid response. Please try again.",
          502,
          "INVALID_PROVIDER_RESPONSE",
        );
      }
    }

    // RegCheck commonly uses HTTP 500 both for an unknown plate and an account
    // with no remaining credits. Check the account balance before deciding.
    if (response.status >= 500) {
      const balance = await getRegCheckCreditBalance(username);
      console.info("[RegCheck] lookup rejected", {
        account: accountIndex + 1,
        providerStatus: response.status,
        remainingCredits: balance ?? "unknown",
      });

      if (balance !== null && balance <= 0) {
        exhaustedAccounts += 1;
        continue;
      }

      // A positive balance means the provider accepted the account but could
      // not resolve this registration. Trying more accounts would waste credit.
      if (balance !== null && balance > 0) {
        plateNotFound = true;
        break;
      }

      // If the credit endpoint is unavailable, try the next configured account
      // before reporting a provider outage.
      unavailableAccounts += 1;
      continue;
    }

    if ([401, 403, 429].includes(response.status)) {
      unavailableAccounts += 1;
      console.warn("[RegCheck] account unavailable", {
        account: accountIndex + 1,
        providerStatus: response.status,
      });
      continue;
    }

    if (response.status === 400 || response.status === 404) {
      plateNotFound = true;
      break;
    }

    unavailableAccounts += 1;
  }

  if (plateNotFound) {
    throw new VehicleLookupError(
      "We could not find that vehicle. Check the registration and try again.",
      404,
      "VEHICLE_NOT_FOUND",
    );
  }

  if (exhaustedAccounts === usernames.length) {
    throw new VehicleLookupError(
      "All configured vehicle lookup accounts are out of credits.",
      503,
      "LOOKUP_CREDITS_EXHAUSTED",
    );
  }

  console.error("[RegCheck] all accounts failed", {
    configuredAccounts: usernames.length,
    exhaustedAccounts,
    unavailableAccounts,
    networkFailures,
  });
  throw new VehicleLookupError(
    "Vehicle lookup is temporarily unavailable. Check the server logs and RegCheck account status.",
    503,
    "PROVIDER_UNAVAILABLE",
  );
}

async function getRegCheckCreditBalance(username: string) {
  try {
    const query = new URLSearchParams({ username });
    const response = await fetch(`${REGCHECK_CREDITS_URL}?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    const value = Number((await response.text()).trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function findVehicleJson(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key.toLowerCase().endsWith("vehiclejson")) return child;
    const nested = findVehicleJson(child);
    if (nested) return nested;
  }
  return null;
}

function normalizeProviderVehicle(raw: Record<string, unknown>, registration: string) {
  const make = textValue(raw.CarMake) || textValue(raw.MakeDescription);
  const model = textValue(raw.CarModel) || textValue(raw.ModelDescription);
  if (!make && !model) {
    throw new VehicleLookupError(
      "We could not find that vehicle. Check the registration and try again.",
      404,
      "VEHICLE_NOT_FOUND",
    );
  }

  return {
    registration,
    make: make || "Unknown",
    model: model || "Unknown",
    description: textValue(raw.Description),
    colour: textValue(raw.Colour),
    year: numberValue(raw.RegistrationYear),
    fuelType: textValue(raw.FuelType),
    engineCapacityCC: numberValue(textValue(raw.EngineSize)),
    bodyStyle: textValue(raw.BodyStyle),
    variant: textValue(raw.Variant),
    transmission: textValue(raw.Transmission),
    numberOfDoors: numberValue(textValue(raw.NumberOfDoors)),
    numberOfSeats: numberValue(textValue(raw.NumberOfSeats)),
    vehicleInsuranceGroup: numberValue(raw.VehicleInsuranceGroup),
    vehicleInsuranceGroupOutOf: numberValue(raw.VehicleInsuranceGroupOutOf),
    abiCode: textValue(raw.ABICode),
    imageUrl: textValue(raw.ImageUrl),
    vehicleIdentificationNumber: textValue(raw.VehicleIdentificationNumber).toUpperCase(),
  };
}

function textValue(value: unknown): string {
  if (value && typeof value === "object" && "CurrentTextValue" in value) {
    return String((value as { CurrentTextValue?: unknown }).CurrentTextValue || "").trim();
  }
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && String(value ?? "").trim() ? parsed : undefined;
}

type NormalizedProviderVehicle = ReturnType<typeof normalizeProviderVehicle>;

type CuvvaFuelType = "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID";

export function parseSharedIntegrationOwnerId(
  configuredValue = process.env.SHARED_INTEGRATION_OWNER_ID,
) {
  const value = String(configuredValue || "").trim();
  if (!Types.ObjectId.isValid(value) || /^0{24}$/.test(value)) {
    throw new VehicleLookupError(
      "Shared vehicle storage is not configured. Please contact support.",
      503,
      "SHARED_VEHICLE_OWNER_NOT_CONFIGURED",
    );
  }
  return new Types.ObjectId(value);
}

function normalizeCuvvaFuelType(value: string | undefined): CuvvaFuelType | undefined {
  const fuel = String(value || "").trim().toUpperCase();
  if (!fuel) return undefined;
  if (fuel.includes("HYBRID") || (fuel.includes("ELECTRIC") && /PETROL|DIESEL/.test(fuel))) {
    return "HYBRID";
  }
  if (fuel.includes("ELECTRIC")) return "ELECTRIC";
  if (fuel.includes("DIESEL") || fuel.includes("HEAVY OIL")) return "DIESEL";
  if (fuel.includes("PETROL") || fuel.includes("GASOLINE")) return "PETROL";
  return undefined;
}

function dateValue(value: unknown): Date | undefined {
  const text = textValue(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function buildSharedVerifiedVehicleUpdate(
  normalized: NormalizedProviderVehicle,
  providerPayload: Record<string, unknown>,
  ownerId: Types.ObjectId,
  now = new Date(),
) {
  const fuelType = normalizeCuvvaFuelType(normalized.fuelType);
  if (!normalized.year || !fuelType) {
    throw new Error("RegCheck did not return a Cuvva-compatible year and fuel type.");
  }

  const optionalProviderFields: Record<string, unknown> = {
    description: normalized.description,
    colour: normalized.colour,
    vehicleIdentificationNumber: normalized.vehicleIdentificationNumber,
    engineCapacityCC: normalized.engineCapacityCC,
    bodyStyle: normalized.bodyStyle,
    variant: normalized.variant,
    transmission: normalized.transmission,
    numberOfDoors: normalized.numberOfDoors,
    numberOfSeats: normalized.numberOfSeats,
    vehicleInsuranceGroup: normalized.vehicleInsuranceGroup,
    vehicleInsuranceGroupOutOf: normalized.vehicleInsuranceGroupOutOf,
    abiCode: normalized.abiCode,
    engineCode: textValue(providerPayload.EngineCode).toUpperCase(),
    engineNumber: textValue(providerPayload.EngineNumber).toUpperCase(),
    immobiliser: textValue(providerPayload.Immobiliser),
    indicativeValue: numberValue(textValue(providerPayload.IndicativeValue)),
    driverSide: textValue(providerPayload.DriverSide),
    imageUrl: normalized.imageUrl,
    powerBHP: numberValue(providerPayload.PowerBHP),
    topSpeed: numberValue(providerPayload.TopSpeed),
    cylinders: numberValue(providerPayload.Cylinders),
    fuelConsumptionMPG: numberValue(
      providerPayload.FuelConsumptionMPG ?? providerPayload.CombinedMPG,
    ),
    motStatus: textValue(providerPayload.MotStatus ?? providerPayload.MOTStatus),
    motExpiryDate: dateValue(providerPayload.MotExpiryDate ?? providerPayload.MOTExpiryDate),
    taxStatus: textValue(providerPayload.TaxStatus),
    taxDueDate: dateValue(providerPayload.TaxDueDate),
    registrationKeeper: textValue(providerPayload.RegistrationKeeper),
    v5cIssueDate: dateValue(providerPayload.V5CIssueDate),
    co2Emissions: numberValue(providerPayload.CO2Emissions),
    euroStatus: textValue(providerPayload.EuroStatus).toUpperCase(),
    wheelplan: textValue(providerPayload.Wheelplan).toUpperCase(),
  };

  const setFields: Record<string, unknown> = {
    registration: normalized.registration,
    make: normalized.make,
    model: normalized.model,
    year: normalized.year,
    fuelType,
    lookupSource: "regcheck",
    regCheckData: providerPayload,
    verified: true,
    verificationSource: "regcheck",
    verifiedAt: now,
    updatedAt: now,
  };
  const unsetFields: Record<string, ""> = {};

  for (const [field, value] of Object.entries(optionalProviderFields)) {
    if (value === undefined || value === null || value === "") {
      unsetFields[field] = "";
    } else {
      setFields[field] = value;
    }
  }

  return {
    $set: setFields,
    ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
    $setOnInsert: {
      createdBy: ownerId,
      associatedAdmins: [ownerId],
      removedForAdmins: [],
      createdAt: now,
    },
  };
}

function presentVehicle(document: Record<string, unknown>): VehicleResult {
  return {
    registration: String(document.registration),
    make: String(document.make),
    model: String(document.model),
    description: optionalString(document.description),
    colour: optionalString(document.colour),
    year: optionalNumber(document.year),
    fuelType: optionalString(document.fuelType),
    engineCapacityCC: optionalNumber(document.engineCapacityCC),
    bodyStyle: optionalString(document.bodyStyle),
    variant: optionalString(document.variant),
    transmission: optionalString(document.transmission),
    numberOfDoors: optionalNumber(document.numberOfDoors),
    numberOfSeats: optionalNumber(document.numberOfSeats),
    vehicleInsuranceGroup: optionalNumber(document.vehicleInsuranceGroup),
    vehicleInsuranceGroupOutOf: optionalNumber(document.vehicleInsuranceGroupOutOf),
    abiCode: optionalString(document.abiCode),
    imageUrl: optionalString(document.imageUrl),
    vehicleIdentificationNumber: optionalString(document.vehicleIdentificationNumber),
    databaseId: optionalString(document._id),
    source: "regcheck",
    verifiedAt: new Date(document.verifiedAt as Date).toISOString(),
  };
}

const optionalString = (value: unknown) => (value ? String(value) : undefined);
const optionalNumber = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : undefined);

export class VehicleLookupError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
