import { Schema, model, models } from "mongoose";

const quoteSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    vehicle: {
      registration: { type: String, required: true },
      make: { type: String, required: true },
      model: { type: String, required: true },
      colour: String,
      year: Number,
      fuelType: String,
      source: { type: String, enum: ["regcheck"], required: true },
      verifiedAt: Date,
    },
    cover: {
      durationUnit: { type: String, enum: ["hours", "days", "weeks"], required: true },
      durationValue: { type: Number, required: true },
      startAt: { type: Date, required: true },
      endAt: { type: Date, required: true },
    },
    driver: {
      title: String,
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      dateOfBirth: { type: Date, required: true },
      occupation: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
    },
    address: {
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      postcode: { type: String, required: true, uppercase: true },
      country: { type: String, default: "GB" },
    },
    licence: {
      number: { type: String, required: true, uppercase: true },
      type: { type: String, required: true },
      heldFor: { type: String, required: true },
      vehicleValue: { type: String, required: true },
      reasonForCover: { type: String, required: true },
    },
    modifications: { type: [String], default: [] },
    pricing: {
      amount: { type: Number, required: true },
      currency: { type: String, default: "GBP" },
      calculationVersion: { type: String, default: "v1" },
    },
    status: { type: String, enum: ["draft", "checkout", "paid", "expired"], default: "draft" },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: "tempify_quotes" },
);

export const Quote = models.Quote || model("Quote", quoteSchema);
