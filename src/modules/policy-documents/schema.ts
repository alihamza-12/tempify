import { z } from "zod";

const text = z.string().trim().min(1).max(200);
const date = z.iso.date();
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

// Server-side rendering data. The payment integration uses this exclusively
// for clearly labelled SAMPLE documents, never as proof of policy issuance.
export const policyDocumentSchema = z.object({
  policy: z.object({
    _id: text,
    policyNumber: text,
    premiumAmount: z.number().positive().finite(),
    excess: z.number().nonnegative().finite(),
    startDate: date,
    endDate: date,
    startTime: time,
    endTime: time,
    coverageType: z.enum(["Comprehensive", "Third Party Only"]),
    // The source certificate explicitly names Wakam and embeds its signature.
    // Never silently render this certificate for a different underwriter.
    underwriter: z.literal("Wakam"),
  }),
  customer: z.object({
    fullName: text,
    firstName: text,
    email: z.email(),
    dateOfBirth: date,
    drivingLicenceNumber: text,
    phone: text,
    address: z.object({
      line1: text,
      line2: z.string().max(200).optional(),
      city: text,
      county: z.string().max(200).optional(),
      postcode: text,
      country: text,
    }),
  }),
  vehicle: z.object({
    registration: text,
    make: text,
    model: text,
    vehicleIdentificationNumber: text,
    colour: text,
    year: z.number().int().min(1900).max(2200).optional(),
  }),
  payment: z.discriminatedUnion("method", [
    z.object({ method: z.literal("card"), brand: text, last4: z.string().regex(/^\d{4}$/) }),
    z.object({ method: z.literal("paymegate") }),
  ]),
}).superRefine((data, ctx) => {
  const start = Date.parse(`${data.policy.startDate}T${data.policy.startTime}:00Z`);
  const end = Date.parse(`${data.policy.endDate}T${data.policy.endTime}:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    ctx.addIssue({ code: "custom", message: "Policy end must be after start.", path: ["policy", "endDate"] });
  }
  if (!Number.isSafeInteger(Math.round(data.policy.premiumAmount * 100)) ||
      Math.abs(data.policy.premiumAmount * 100 - Math.round(data.policy.premiumAmount * 100)) > 0.000001) {
    ctx.addIssue({ code: "custom", message: "Premium must be an exact GBP pence amount.", path: ["policy", "premiumAmount"] });
  }
});

export type PolicyDocumentInput = z.infer<typeof policyDocumentSchema>;

