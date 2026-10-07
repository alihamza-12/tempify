import { Schema, model, models } from "mongoose";

const verificationTokenSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, enum: ["register"], default: "register" },
    codeHash: { type: String, required: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: "tempify_verification_tokens" },
);

verificationTokenSchema.index({ email: 1, purpose: 1 }, { unique: true });

export const VerificationToken =
  models.VerificationToken || model("VerificationToken", verificationTokenSchema);
