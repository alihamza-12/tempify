import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { findOrVerifyVehicle } from "@/modules/vehicles/service";
import { calculateQuotePrice, getEndDate } from "./pricing";
import type { CreateQuoteInput } from "./schema";

export async function createQuote(input: CreateQuoteInput) {
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

  // Pricing is always calculated on the server. Starts more than five minutes
  // in the past receive the configured historical-start surcharge.
  const pricing = calculateQuotePrice(input.cover.durationUnit, input.cover.durationValue, startAt);
  const endAt = getEndDate(startAt, input.cover.durationUnit, input.cover.durationValue);
  const publicId = randomUUID();

  const quote = await Quote.create({
    publicId,
    vehicle: {
      registration: vehicle.registration,
      make: vehicle.make,
      model: vehicle.model,
      colour: vehicle.colour,
      year: vehicle.year,
      fuelType: vehicle.fuelType,
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
