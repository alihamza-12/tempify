import mongoose from "mongoose";

export type PricingCategory = "past" | "present" | "future";
export type DurationUnit = "hours" | "days" | "weeks";

export type CuvvafyPricingConfig = {
  configId: string;
  durationOptions: {
    hours: number[];
    days: number[];
    weeks: number[];
  };
  pricingMode: "flat" | "formula" | "both";
  categoryModes: {
    present: "flat" | "formula" | "both";
    past: "flat" | "formula" | "both";
    future: "flat" | "formula" | "both";
  };
  pricing: {
    present: { hours: Record<string, number>; days: Record<string, number>; weeks: Record<string, number> };
    past: { hours: Record<string, number>; days: Record<string, number>; weeks: Record<string, number> };
    future: { hours: Record<string, number>; days: Record<string, number>; weeks: Record<string, number> };
  };
  formula: {
    present: { hours: { base: number; perExtra: number }; days: { base: number; perExtra: number }; weeks: { base: number; perExtra: number } };
    past: { hours: { base: number; perExtra: number }; days: { base: number; perExtra: number }; weeks: { base: number; perExtra: number } };
    future: { hours: { base: number; perExtra: number }; days: { base: number; perExtra: number }; weeks: { base: number; perExtra: number } };
  };
  graceMinutes: number;
  currency: string;
  isActive: boolean;
};

const formulaUnitSchema = new mongoose.Schema(
  {
    base: { type: Number, default: 0 },
    perExtra: { type: Number, default: 0 },
  },
  { _id: false }
);

const categoryPricingSchema = new mongoose.Schema(
  {
    hours: { type: Map, of: Number, default: {} },
    days: { type: Map, of: Number, default: {} },
    weeks: { type: Map, of: Number, default: {} },
  },
  { _id: false }
);

const categoryFormulaSchema = new mongoose.Schema(
  {
    hours: { type: formulaUnitSchema, default: () => ({ base: 15.13, perExtra: 4.85 }) },
    days: { type: formulaUnitSchema, default: () => ({ base: 29.95, perExtra: 18.5 }) },
    weeks: { type: formulaUnitSchema, default: () => ({ base: 109.95, perExtra: 79 }) },
  },
  { _id: false }
);

const cuvvafyPricingSchema = new mongoose.Schema(
  {
    configId: { type: String, default: "global", unique: true, index: true },
    durationOptions: {
      hours: { type: [Number], default: [1, 3, 5, 12, 24] },
      days: { type: [Number], default: [1, 2, 3, 4, 5, 6, 7] },
      weeks: { type: [Number], default: [1, 2, 3, 4] },
    },
    pricingMode: { type: String, enum: ["flat", "formula", "both"], default: "both" },
    categoryModes: {
      present: { type: String, enum: ["flat", "formula", "both"], default: "both" },
      past: { type: String, enum: ["flat", "formula", "both"], default: "both" },
      future: { type: String, enum: ["flat", "formula", "both"], default: "both" },
    },
    pricing: {
      present: { type: categoryPricingSchema, default: () => ({}) },
      past: { type: categoryPricingSchema, default: () => ({}) },
      future: { type: categoryPricingSchema, default: () => ({}) },
    },
    formula: {
      present: { type: categoryFormulaSchema, default: () => ({}) },
      past: { type: categoryFormulaSchema, default: () => ({}) },
      future: { type: categoryFormulaSchema, default: () => ({}) },
    },
    graceMinutes: { type: Number, default: 5 },
    currency: { type: String, default: "GBP" },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "cuvvafy_pricings" }
);

type CuvvafyPricingDocument = mongoose.Document & CuvvafyPricingConfig & {
  createdAt?: Date;
  updatedAt?: Date;
};

export const CuvvafyPricing =
  (mongoose.models.CuvvafyPricing as mongoose.Model<CuvvafyPricingDocument>) ||
  mongoose.model<CuvvafyPricingDocument>("CuvvafyPricing", cuvvafyPricingSchema);
