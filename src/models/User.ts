import { Schema, model, models, type InferSchemaType } from "mongoose";

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    county: { type: String, trim: true },
    postcode: { type: String, trim: true, uppercase: true },
    country: { type: String, default: "GB" },
  },
  { _id: false },
);

/**
 * Compatible with the existing Cuvva `users` collection. Tempify customers can
 * use the same email/password in either customer application. Tempify-specific
 * profile fields are additive and do not change Cuvva's required fields.
 */
const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    title: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "Prefer not to say"],
    },
    occupation: { type: String, trim: true },
    drivingLicenceNumber: { type: String, trim: true, uppercase: true },
    licenceType: { type: String, trim: true },
    licenceHeldFor: { type: String, trim: true },
    lastFourDigits: {
      type: String,
      trim: true,
      validate: {
        validator: (value: string | undefined) => !value || /^\d{4}$/.test(value),
        message: "Card last four digits must contain exactly 4 numbers.",
      },
    },
    address: addressSchema,
    role: {
      type: String,
      enum: ["Super Admin", "Sub Admin", "Customer"],
      default: "Customer",
      required: true,
    },
    status: { type: String, enum: ["Active", "Suspended"], default: "Active" },
    suspendedAt: { type: Date, default: null },
    suspendedUntil: { type: Date, default: null },
    suspendedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expiresAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    additionalEmails: { type: [String], default: [] },
    additionalPhones: { type: [String], default: [] },
    refreshTokens: { type: [String], default: [] },
    emailVerifiedAt: Date,
    authSource: { type: String, default: "tempify" },
  },
  {
    timestamps: true,
    collection: "users",
    strict: false,
  },
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdBy: 1 });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = models.User || model("User", userSchema);
