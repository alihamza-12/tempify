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

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    dateOfBirth: Date,
    gender: String,
    drivingLicenceNumber: { type: String, trim: true, uppercase: true },
    address: addressSchema,
    role: {
      type: String,
      enum: ["Super Admin", "Sub Admin", "Customer"],
      default: "Customer",
      required: true,
    },
    status: { type: String, enum: ["Active", "Suspended"], default: "Active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
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

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = models.User || model("User", userSchema);
