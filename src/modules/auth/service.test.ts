import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  userFindOne: vi.fn(),
  userCreate: vi.fn(),
  tokenFindOne: vi.fn(),
  tokenFindOneAndUpdate: vi.fn(),
  tokenDeleteOne: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/models/User", () => ({ User: { findOne: mocks.userFindOne, create: mocks.userCreate } }));
vi.mock("@/models/VerificationToken", () => ({
  VerificationToken: {
    findOne: mocks.tokenFindOne,
    findOneAndUpdate: mocks.tokenFindOneAndUpdate,
    deleteOne: mocks.tokenDeleteOne,
  },
}));
vi.mock("@/modules/email/service", () => ({ sendVerificationEmail: mocks.sendVerificationEmail }));

import { beginRegistration, completeRegistration } from "./service";

const signup = {
  firstName: "Ava",
  lastName: "Customer",
  email: "Ava.Customer@example.com",
  password: "A-strong-password-2026",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
  mocks.connect.mockResolvedValue(undefined);
  mocks.userFindOne
    .mockReturnValueOnce({ select: () => ({ lean: async () => null }) })
    .mockResolvedValueOnce(null);
  mocks.tokenFindOne
    .mockReturnValueOnce({ lean: async () => null });
  mocks.tokenFindOneAndUpdate.mockResolvedValue({});
  mocks.sendVerificationEmail.mockResolvedValue({ id: "otp-email" });
  mocks.tokenDeleteOne.mockResolvedValue({ deletedCount: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe("Tempify customer registration compatibility", () => {
  it("never returns a development OTP in the registration response", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "console");
    await expect(beginRegistration(signup)).resolves.toEqual({});
  });

  it("saves a Cuvva-compatible bcrypt customer account after OTP and accepts its password with bcrypt", async () => {
    await beginRegistration(signup);
    const otpEmail = mocks.sendVerificationEmail.mock.calls[0][0] as { email: string; code: string };
    const update = mocks.tokenFindOneAndUpdate.mock.calls[0][1] as { $set: { passwordHash: string; email?: string } };
    const storedHash = update.$set.passwordHash;
    const userId = "0123456789abcdef01234567";
    const createdUser = {
      _id: userId,
      email: "ava.customer@example.com",
      fullName: "Ava Customer",
      role: "Customer",
      createdBy: null as string | null,
      save: vi.fn(async function (this: { createdBy: string | null }) { return this; }),
    };
    mocks.userCreate.mockImplementation(async (fields: Record<string, unknown>) => {
      expect(fields).toMatchObject({
        email: "ava.customer@example.com",
        fullName: "Ava Customer",
        firstName: "Ava",
        lastName: "Customer",
        role: "Customer",
        status: "Active",
        authSource: "tempify",
      });
      expect(fields.password).toBe(storedHash);
      return createdUser;
    });
    const token = {
      _id: "otp-token",
      codeHash: await bcrypt.hash(otpEmail.code, 10),
      passwordHash: storedHash,
      firstName: "Ava",
      lastName: "Customer",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      save: vi.fn(async () => undefined),
    };
    mocks.tokenFindOne.mockReturnValueOnce({ select: async () => token });

    const result = await completeRegistration(otpEmail.email, otpEmail.code);

    expect(result).toEqual({
      id: userId,
      email: "ava.customer@example.com",
      fullName: "Ava Customer",
      role: "Customer",
    });
    expect(createdUser.createdBy).toBe(userId);
    expect(createdUser.save).toHaveBeenCalledOnce();
    // The Cuvva backend's bcrypt.compare(password, user.password) accepts this
    // pre-hashed value; its save hook recognizes the $2 bcrypt prefix.
    expect(storedHash).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare(signup.password, storedHash)).resolves.toBe(true);
    expect(mocks.tokenDeleteOne).toHaveBeenCalledWith({ _id: "otp-token" });
  });
});
