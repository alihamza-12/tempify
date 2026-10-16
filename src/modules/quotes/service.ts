import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { findOrVerifyVehicle } from "@/modules/vehicles/service";
import { calculateQuotePrice, getEndDate } from "./pricing";
import type { CreateQuoteInput } from "./schema";
import { saveCustomerProfile } from "@/modules/profile/service";

export async function createQuote(input: CreateQuoteInput, userId?: string) {
  await connectToDatabase();
  const { vehicle } = await findOrVerifyVehicle(input.registration);
  const startAt = new Date(input.cover.startAt);
  if (Number.isNaN(startAt.getTime())) {
    throw new QuoteError("Choose a valid start date and time.", 400);
  }

  const birthDate = new Date(`${input.driver.dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) throw new QuoteError("Enter a valid date of birth.", 400);
  const age = new Date().getUTCFullYear() - birthDate.getUTCFullYear();
  if (age < 17) throw new QuoteError("The driver must be at least 17 years old.", 400);

  if (userId) {
    await saveCustomerProfile(userId, {
      title: input.driver.title,
      firstName: input.driver.firstName,
      lastName: input.driver.lastName,
      email: input.driver.email,
      dateOfBirth: input.driver.dateOfBirth,
      gender: input.driver.gender,
      occupation: input.driver.occupation,
      phone: input.driver.phone,
      drivingLicenceNumber: input.licence.number,
      licenceType: input.licence.type,
      licenceHeldFor: input.licence.heldFor,
      lastFourDigits: input.licence.lastFourDigits,
      address: { ...input.address, country: "GB" },
    });
  }

  // Pricing is now dynamic from Cuvva super admin dashboard (cuvvafy_pricings collection)
  // Past/Present/Future categories based on startAt vs now, with flat + formula support
  // Falls back to hardcoded pricing if DB config not found
  const pricing = await calculateQuotePrice(input.cover.durationUnit, input.cover.durationValue, startAt);
  const endAt = getEndDate(startAt, input.cover.durationUnit, input.cover.durationValue);
  const publicId = randomUUID();

  const quote = await Quote.create({
    publicId,
    userId: userId || null,
    vehicleId: vehicle.databaseId || null,
    vehicle: {
      registration: vehicle.registration,
      make: vehicle.make,
      model: vehicle.model,
      colour: vehicle.colour,
      year: vehicle.year,
      fuelType: vehicle.fuelType,
      vehicleIdentificationNumber: vehicle.vehicleIdentificationNumber,
      source: vehicle.source,
      verifiedAt: vehicle.verifiedAt,
    },
    cover: { ...input.cover, startAt, endAt },
    driver: { ...input.driver, dateOfBirth: birthDate },
    address: {
      ...input.address,
      postcode: input.address.postcode.toUpperCase(),
      country: "GB",
    },
    licence: {
      ...input.licence,
      number: input.licence.number.toUpperCase(),
    },
    modifications: input.modifications,
    pricing,
    status: "draft",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return { publicId: quote.publicId, pricing };
}

export class QuoteError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
