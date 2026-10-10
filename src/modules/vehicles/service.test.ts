import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { buildCuvvaVerifiedVehicleUpdate, cleanRegistration } from "./service";

describe("vehicle registration normalisation", () => {
  it("removes spaces and punctuation and uppercases", () => {
    expect(cleanRegistration(" sj18-obw ")).toBe("SJ18OBW");
  });
});

describe("Cuvva verified vehicle synchronization", () => {
  it("builds a provider-verified upsert without changing Cuvva source code", () => {
    const ownerId = new Types.ObjectId("507f1f77bcf86cd799439011");
    const verifiedAt = new Date("2026-10-10T08:00:00.000Z");
    const providerPayload = {
      CarMake: { CurrentTextValue: "Ford" },
      CarModel: { CurrentTextValue: "Focus" },
      RegistrationYear: "2020",
      FuelType: { CurrentTextValue: "Petrol" },
      VehicleIdentificationNumber: "wf0example",
    };

    const update = buildCuvvaVerifiedVehicleUpdate(
      {
        registration: "SJ18OBW",
        make: "Ford",
        model: "Focus",
        description: "Ford Focus",
        colour: "Blue",
        year: 2020,
        fuelType: "Petrol",
        engineCapacityCC: 999,
        bodyStyle: "Hatchback",
        variant: "Zetec",
        transmission: "Manual",
        numberOfDoors: 5,
        numberOfSeats: 5,
        vehicleInsuranceGroup: 12,
        vehicleInsuranceGroupOutOf: 50,
        abiCode: "12345678",
        imageUrl: "https://example.test/car.jpg",
      },
      providerPayload,
      ownerId,
      verifiedAt,
    );

    expect(update.$set).toMatchObject({
      registration: "SJ18OBW",
      make: "Ford",
      model: "Focus",
      year: 2020,
      fuelType: "PETROL",
      lookupSource: "regcheck",
      regCheckData: providerPayload,
      verified: true,
      verificationSource: "regcheck",
      verifiedAt,
    });
    expect(update.$setOnInsert).toMatchObject({
      createdBy: ownerId,
      associatedAdmins: [ownerId],
      removedForAdmins: [],
      createdAt: verifiedAt,
    });
  });
});
