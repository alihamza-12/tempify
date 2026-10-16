import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), quote: vi.fn(), user: vi.fn(), profile: vi.fn(),
  findOrder: vi.fn(), createOrder: vi.fn(), createRemote: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/models/Quote", () => ({ Quote: { findOne: mocks.quote } }));
vi.mock("@/models/User", () => ({ User: { findById: mocks.user } }));
vi.mock("@/models/Order", () => ({ Order: { findOne: mocks.findOrder, create: mocks.createOrder } }));
vi.mock("@/modules/payments/paymegate", () => ({ createPayMeGateOrder: mocks.createRemote }));
vi.mock("@/modules/profile/schema", () => ({ customerProfileSchema: { parse: (value: unknown) => value } }));
vi.mock("@/modules/profile/service", () => ({ saveCustomerProfile: mocks.profile }));

import { POST } from "../../app/api/checkout/route";

const call = () => POST(new Request("https://example.invalid/api/checkout", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ quoteId: "f146cc6a-9a42-435f-9e65-746cbb8e493f" }),
}));

describe("checkout has no optional portfolio payment path", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ userId: "test-user" });
    mocks.user.mockReturnValue({ select: vi.fn().mockResolvedValue({
      _id: "test-user", email: "owner@example.com", status: "Active", role: "Customer",
    }) });
    mocks.quote.mockResolvedValue({
      _id: "test-quote", vehicleId: "test-vehicle",
      driver: { title: "Mx", firstName: "Alex", lastName: "Sample", dateOfBirth: "1995-04-10", gender: "Other", occupation: "Example", phone: "00000000000", email: "owner@example.com" },
      address: { line1: "1 Example Street", city: "Sample Town", postcode: "AB1 2CD" },
      licence: { number: "SAMPLE", type: "Full", heldFor: "5 years" },
      vehicle: { registration: "SAMPLE1", make: "Example", model: "Sample", vehicleIdentificationNumber: "SAMPLEVIN" },
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, "false", "TRUE", "1", ""])("does not create an order when the live gate is %s", async (gate) => {
    vi.stubEnv("LIVE_POLICY_CHECKOUT_ENABLED", gate);
    const response = await call();
    expect(response.status).toBe(503);
    expect(mocks.createRemote).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.findOrder).not.toHaveBeenCalled();
  });

  it("ignores retired settings even if an old environment still enables an allowlisted owner", async () => {
    vi.stubEnv("LIVE_POLICY_CHECKOUT_ENABLED", "false");
    vi.stubEnv("PORTFOLIO_PAYMENT_TEST_ENABLED", "true");
    vi.stubEnv("PORTFOLIO_PAYMENT_TEST_EMAILS", "owner@example.com");
    expect((await call()).status).toBe(503);
    expect(mocks.createRemote).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
});
