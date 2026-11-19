import { randomInt } from "node:crypto";
import { Schema, model, models } from "mongoose";

const policySchema = new Schema(
  {
    policyNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    premiumAmount: { type: Number, required: true },
    excess: { type: Number, default: 500, min: 0 },
    cardLast4: {
      type: String,
      trim: true,
      match: [/^\d{4}$/, "Card last four digits must contain exactly 4 numbers."],
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    policyType: {
      type: String,
      enum: ["Temporary Car", "Temporary Van", "Learner Driver", "Impound", "Motorhome", "Drive Away"],
      required: true,
    },
    coverageType: {
      type: String,
      enum: ["Comprehensive", "Third Party Only"],
      required: true,
    },
    underwriter: {
      type: String,
      enum: ["Wakam", "ERS Syndicate", "Crawford"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Upcoming", "Active", "Expired", "Cancelled"],
      default: "Upcoming",
    },
    internalNotes: { type: String, trim: true },
    // Tempify-only idempotency key. Existing Cuvva screens ignore this field.
    tempifyOrderId: { type: String, select: false },
  },
  { timestamps: true, collection: "policies" },
);

policySchema.index({ customerId:  1, status: 1 });
policySchema.index({ vehicleId: 1 });
policySchema.index({ createdBy: 1 });
policySchema.index({ status: 1, startDate: 1, startTime: 1 });
policySchema.index({ status: 1, endDate: 1, endTime: 1 });
policySchema.index({ tempifyOrderId: 1 }, { unique: true, sparse: true });

policySchema.pre("validate", async function () {
  if (this.policyNumber?.trim()) return;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let candidate = "PPWAKF";
    for (let index = 0; index < 11; index += 1) candidate += alphabet[randomInt(0, alphabet.length)];
    const existing = await this.db.collection("policies").findOne({ policyNumber: candidate }, { projection: { _id: 1 } });
    if (!existing) {
      this.policyNumber = candidate;
      return;
    }
  }
  throw new Error("Could not allocate a unique Cuvva-compatible policy number.");
});

export const Policy = models.Policy || model("Policy", policySchema);
