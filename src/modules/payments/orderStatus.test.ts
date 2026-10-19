import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  session: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
  remote: vi.fn(),
  markPaid: vi.fn(),
  sendPaidEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/lib/session", () => ({ getSession: mocks.session }));
vi.mock("@/models/Order", () => ({ Order: { findOne: mocks.findOne, updateOne: mocks.updateOne } }));
vi.mock("@/modules/payments/fulfillment", () => ({ markOrderPaid: mocks.markPaid, sendPaidOrderEmail: mocks.sendPaidEmail }));
vi.mock("@/modules/payments/stripe", () => ({
  getStripeSession: mocks.remote,
  getPayMeGateOrder: mocks.remote,
  mapPaymentStatus: (status: string) => status.toLowerCase(),
}));

import { GET } from "../../app/api/orders/[id]/route";

const initial = {
  _id: "database-order", publicId: "local-order", userId: "customer-1",
  stripeSessionId: "provider-order", paymegateOrderUUID: "provider-order", amount: 12.34, currency: "GBP",
  status: "unpaid", paidAt: null, policyId: null,
  fulfillmentStatus: "pending_payment", confirmationEmailStatus: "pending",
};
const remote = {
  sessionId: "provider-order",
  paymentIntentId: "30569045-9e69-41cb-9083-8ac5e3d76a5e",
  paidTransactionUUID: "30569045-9e69-41cb-9083-8ac5e3d76a5e",
  externalId: "local-order", orderUUID: "provider-order", amount: "12.34",
  currency: "GBP", status: "PAID", paidAt: "2026-10-14T12:00:00Z",
  metadata: { externalId: "local-order" },
};
const call = () => GET(new Request("https://example.test/api/orders/local-order"), { params: Promise.resolve({ id: "local-order" }) });
const reads = (...values: unknown[]) => values.forEach((value) => mocks.findOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(value) }));

describe("order status uses persisted, validated payment state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_only");
    vi.stubEnv("PAYMEGATE_API_KEY", "test-only");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.session.mockResolvedValue({ userId: "customer-1" });
    mocks.remote.mockResolvedValue(remote);
    mocks.markPaid.mockResolvedValue({ accepted: true });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("requires authentication before accessing orders", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("restricts reads to the signed-in customer", async () => {
    reads(null);
    expect((await call()).status).toBe(404);
    expect(mocks.findOne).toHaveBeenCalledWith({ publicId: "local-order", userId: "customer-1" });
    expect(mocks.remote).not.toHaveBeenCalled();
  });

  it.each([
    { amount: "12.344" }, { currency: "USD" },
    { orderUUID: "other-provider-order" }, { externalId: "other-local-order" },
  ])("never reports paid for a mismatched provider response: %j", async (mismatch) => {
    reads(initial, initial);
    mocks.remote.mockResolvedValue({ ...remote, ...mismatch });
    const response = await call();
    expect((await response.json()).status).toBe("unpaid");
    expect(mocks.markPaid).not.toHaveBeenCalled();
  });

  it("does not report paid if fulfillment rejects the response", async () => {
    reads(initial, initial);
    mocks.markPaid.mockResolvedValue({ accepted: false });
    const response = await call();
    expect((await response.json()).status).toBe("unpaid");
  });

  it("returns fresh paid, fulfillment and email state after reconciliation", async () => {
    reads(initial, { ...initial, status: "paid", paidAt: remote.paidAt, fulfillmentStatus: "blocked_pending_authority", confirmationEmailStatus: "failed" });
    const response = await call();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ status: "paid", paidAt: remote.paidAt, policyIssued: false, fulfillmentStatus: "blocked_pending_authority", confirmationEmailStatus: "failed" });
    expect(mocks.markPaid).toHaveBeenCalledWith(expect.objectContaining({ externalId: "local-order", orderUUID: "provider-order" }));
  });

  it("cannot overwrite a concurrently verified payment with failed status", async () => {
    reads(initial, { ...initial, status: "paid" });
    mocks.remote.mockResolvedValue({ ...remote, status: "FAILED" });
    const response = await call();
    expect(mocks.updateOne).toHaveBeenCalledWith({ _id: "database-order", status: "unpaid" }, { $set: { status: "failed" } });
    expect((await response.json()).status).toBe("paid");
  });

  it("does not infer policy issuance from a policy ID alone", async () => {
    const blocked = { ...initial, status: "paid", policyId: "policy-id", fulfillmentStatus: "blocked_pending_authority" };
    reads(blocked, blocked);
    expect((await (await call()).json()).policyIssued).toBe(false);
  });
});
