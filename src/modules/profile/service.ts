import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import type { CustomerProfileInput } from "./schema";

export async function saveCustomerProfile(userId: string, input: CustomerProfileInput) {
  await connectToDatabase();

  const [emailOwner, licenceOwner] = await Promise.all([
    User.findOne({ email: input.email, _id: { $ne: userId } }).select("_id").lean(),
    User.findOne({
      role: "Customer",
      drivingLicenceNumber: input.drivingLicenceNumber,
      _id: { $ne: userId },
    })
      .collation({ locale: "en", strength: 2 })
      .select("_id")
      .lean(),
  ]);

  if (emailOwner) throw new ProfileError("That email address is already in use.", 409);
  if (licenceOwner) throw new ProfileError("That driving licence is already linked to another customer.", 409);

  const dateOfBirth = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(dateOfBirth.getTime())) {
    throw new ProfileError("Enter a valid date of birth.", 400);
  }

  const age = new Date().getUTCFullYear() - dateOfBirth.getUTCFullYear();
  if (age < 17) throw new ProfileError("The driver must be at least 17 years old.", 400);

  const profileFields = {
    title: input.title,
    fullName: `${input.firstName} ${input.lastName}`.trim(),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    dateOfBirth,
    gender: input.gender,
    occupation: input.occupation,
    phone: input.phone,
    drivingLicenceNumber: input.drivingLicenceNumber,
    licenceType: input.licenceType,
    licenceHeldFor: input.licenceHeldFor,
    address: { ...input.address, country: "GB" },
    ...(input.lastFourDigits ? { lastFourDigits: input.lastFourDigits } : {}),
  };

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: profileFields,
      ...(!input.lastFourDigits ? { $unset: { lastFourDigits: "" } } : {}),
    },
    { new: true, runValidators: true },
  ).lean();

  if (!user) throw new ProfileError("Customer account was not found.", 404);
  return serializeCustomerProfile(user as Record<string, unknown>);
}

export function serializeCustomerProfile(user: Record<string, unknown>) {
  const address = (user.address || {}) as Record<string, unknown>;
  const fullNameParts = String(user.fullName || "").trim().split(/\s+/);
  const firstName = String(user.firstName || fullNameParts[0] || "");
  const lastName = String(user.lastName || fullNameParts.slice(1).join(" ") || "");
  const dateOfBirth = user.dateOfBirth ? new Date(user.dateOfBirth as Date) : null;

  return {
    title: String(user.title || ""),
    firstName,
    lastName,
    email: String(user.email || ""),
    dateOfBirth:
      dateOfBirth && !Number.isNaN(dateOfBirth.getTime())
        ? dateOfBirth.toISOString().slice(0, 10)
        : "",
    gender: String(user.gender || ""),
    occupation: String(user.occupation || ""),
    phone: String(user.phone || ""),
    drivingLicenceNumber: String(user.drivingLicenceNumber || ""),
    licenceType: String(user.licenceType || ""),
    licenceHeldFor: String(user.licenceHeldFor || ""),
    lastFourDigits: String(user.lastFourDigits || ""),
    address: {
      line1: String(address.line1 || ""),
      line2: String(address.line2 || ""),
      city: String(address.city || ""),
      county: String(address.county || ""),
      postcode: String(address.postcode || ""),
      country: "GB" as const,
    },
  };
}

export class ProfileError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
