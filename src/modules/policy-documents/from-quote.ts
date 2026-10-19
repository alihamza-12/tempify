import { createHash } from "node:crypto";
import { z } from "zod";
import { gbpPence } from "@/modules/payments/validation";
import { policyDocumentSchema } from "./schema";

const required = z.string().trim().min(1);
const quoteSchema = z.object({
  driver: z.object({ firstName: required, lastName: required, email: z.email(), dateOfBirth: z.coerce.date(), phone: required }),
  address: z.object({ line1: required, line2: z.string().optional(), city: required, county: z.string().optional(), postcode: required, country: z.string().optional() }),
  licence: z.object({ number: required }),
  vehicle: z.object({ registration: required, make: required, model: required, vehicleIdentificationNumber: required, colour: z.string().optional(), year: z.number().optional() }),
  cover: z.object({ startAt: z.coerce.date(), endAt: z.coerce.date() }),
  pricing: z.object({ amount: z.number(), currency: z.string() }),
});

type PaymentOrder = { publicId: string; customerEmail: string; amount: number; currency: string };

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (name: string) => parts.find((part) => part.type === name)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Snapshot the server's quote before checkout so quote TTL cannot lose PDFs. */
export function sampleDocumentInputFromQuote(rawQuote: unknown, order: PaymentOrder) {
  const quote = quoteSchema.parse(rawQuote);
  if (quote.driver.email.toLowerCase() !== order.customerEmail.toLowerCase() ||
      quote.pricing.currency !== "GBP" || order.currency !== "GBP" ||
      gbpPence(quote.pricing.amount) === null || gbpPence(quote.pricing.amount) !== gbpPence(order.amount)) {
    throw new Error("Quote does not match the paid order's recipient, amount or currency.");
  }
  const start = londonParts(quote.cover.startAt);
  // Original Cuvva template treats its end minute as covered through :59.
  const end = londonParts(new Date(quote.cover.endAt.getTime() - 60_000));
  const reference = `SAMPLE-${createHash("sha256").update(order.publicId).digest("hex").slice(0, 12).toUpperCase()}`;
  return policyDocumentSchema.parse({
    policy: {
      _id: order.publicId, policyNumber: reference, premiumAmount: order.amount,
      // Fixed values belong to the sample template, not an underwritten contract.
      excess: 500, coverageType: "Comprehensive", underwriter: "Wakam",
      startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time,
    },
    customer: {
      fullName: `${quote.driver.firstName} ${quote.driver.lastName}`.trim(),
      firstName: quote.driver.firstName, email: order.customerEmail,
      dateOfBirth: quote.driver.dateOfBirth.toISOString().slice(0, 10),
      drivingLicenceNumber: quote.licence.number, phone: quote.driver.phone,
      address: { ...quote.address, country: quote.address.country || "GB" },
    },
    vehicle: { ...quote.vehicle, colour: quote.vehicle.colour || "Not provided" },
    payment: { method: "stripe" },
  });
}
