import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { VerificationToken } from "@/models/VerificationToken";
import { sendVerificationEmail } from "@/modules/email/service";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function beginRegistration(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  await connectToDatabase();
  const email = input.email.toLowerCase();

  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) throw new RegistrationError("An account already exists for this email.", 409);

  const previous = await VerificationToken.findOne({ email, purpose: "register" }).lean();
  if (previous?.lastSentAt && Date.now() - new Date(previous.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
    throw new RegistrationError("Please wait a minute before requesting another code.", 429);
  }

  const code = String(randomInt(100000, 1000000));
  const [codeHash, passwordHash] = await Promise.all([
    bcrypt.hash(code, 10),
    bcrypt.hash(input.password, 12),
  ]);

  await VerificationToken.findOneAndUpdate(
    { email, purpose: "register" },
    {
      $set: {
        codeHash,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        attempts: 0,
        lastSentAt: new Date(),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  try {
    await sendVerificationEmail({ email, firstName: input.firstName, code });
  } catch (error) {
    await VerificationToken.deleteOne({ email, purpose: "register" });
    throw error;
  }

  return process.env.EMAIL_DELIVERY_MODE === "console" && process.env.NODE_ENV !== "production"
    ? { developmentCode: code }
    : {};
}

export async function completeRegistration(emailInput: string, code: string) {
  await connectToDatabase();
  const email = emailInput.toLowerCase();
  const token = await VerificationToken.findOne({ email, purpose: "register" }).select("+codeHash +passwordHash");

  if (!token || token.expiresAt.getTime() < Date.now()) {
    throw new RegistrationError("This verification code has expired. Request a new one.", 400);
  }
  if (token.attempts >= 5) {
    throw new RegistrationError("Too many incorrect attempts. Request a new code.", 429);
  }

  const correct = await bcrypt.compare(code, token.codeHash);
  if (!correct) {
    token.attempts += 1;
    await token.save();
    throw new RegistrationError("The verification code is incorrect.", 400);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    await VerificationToken.deleteOne({ _id: token._id });
    throw new RegistrationError("An account already exists for this email.", 409);
  }

  const fullName = `${token.firstName} ${token.lastName}`.trim();
  const user = await User.create({
    fullName,
    firstName: token.firstName,
    lastName: token.lastName,
    email,
    password: token.passwordHash,
    role: "Customer",
    status: "Active",
    emailVerifiedAt: new Date(),
    authSource: "tempify",
  });

  await VerificationToken.deleteOne({ _id: token._id });
  return { id: String(user._id), email: user.email, fullName: user.fullName, role: user.role };
}

export class RegistrationError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
