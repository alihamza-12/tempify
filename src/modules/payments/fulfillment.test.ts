import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(), findById: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn(),
  quoteUpdate: vi.fn(), quoteFind: vi.fn(), emailSend: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/models/Order", () => ({ Order: mocks }));
vi.mock("@/models/Quote", () => ({ Quote: { updateOne: mocks.quoteUpdate, findById: mocks.quoteFind } }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.emailSend }; } }));

import { markOrderPaid, sendPaidOrderEmail } from "./fulfillment";
import { samplePolicy } from "@/modules/policy-documents/fixture";
import { EMAIL_RETRY_WINDOW_MS } from "./email-retry";

// Small in-memory atomic-update double. Real document generation/email payload
// construction runs; MongoDB and Resend network calls are the only substitutes.
let order: Record<string, unknown>;
const number = (value: unknown) => value instanceof Date ? value.getTime() : Number(value);
function matches(record: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "$and") return (condition as Record<string, unknown>[]).every((item) => matches(record, item));
    if (key === "$or") return (condition as Record<string, unknown>[]).some((item) => matches(record, item));
    const actual = record[key];
    if (condition === null) return actual == null;
    if (typeof condition !== "object" || condition instanceof Date) return actual === condition;
    return Object.entries(condition as Record<string, unknown>).every(([operator, expected]) => {
      if (operator === "$ne") return actual !== expected;
      if (operator === "$in") return (expected as unknown[]).includes(actual);
      if (operator === "$exists") return (actual !== undefined) === expected;
      if (operator === "$lt") return number(actual) < number(expected);
      if (operator === "$lte") return number(actual) <= number(expected);
      if (operator === "$gt") return number(actual) > number(expected);
      throw new Error(`Unsupported test operator ${operator}`);
    });
  });
}
function update(filter: Record<string, unknown>, change: Record<string, Record<string, unknown>>) {
  if (!matches(order, filter)) return null;
  Object.assign(order, structuredClone(change.$set || {}));
  for (const key of Object.keys(change.$unset || {})) delete order[key];
  for (const [key, value] of Object.entries(change.$inc || {})) order[key] = Number(order[key] || 0) + Number(value);
  for (const [key, value] of Object.entries(change.$addToSet || {})) order[key] = [...new Set([...(order[key] as unknown[] || []), value])];
  return structuredClone(order);
}
const event = { transactionUUID: "30569045-9e69-41cb-9083-8ac5e3d76a5e", externalId: "order-1", eventId: "event-1", orderUUID: "provider-1", amount: "25.00", currency: "GBP" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-only");
  vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
  vi.stubEnv("PAYMENT_EMAIL_FROM", "Cuvva <auto@cuvvapolicies.com>");
  // Both former extra switches are irrelevant: neither is read by the sender.
  vi.stubEnv("POLICY_DOCUMENT_DELIVERY_ENABLED", "false");
  vi.stubEnv("LIVE_POLICY_CHECKOUT_ENABLED", "false");
  order = {
    _id: "db-order", publicId: "order-1", userId: "test-user", quoteId: "quote-1",
    customerEmail: samplePolicy.customer.email, amount: 25, currency: "GBP",
    stripeSessionId: "provider-1", paymegateOrderUUID: "provider-1", status: "unpaid", processedEventIds: [],
    confirmationEmailStatus: "pending", confirmationEmailAttempts: 0,
    documentSnapshot: { ...samplePolicy, policy: { ...samplePolicy.policy, _id: "order-1" } },
  };
  mocks.findOne.mockImplementation(async (filter) => matches(order, filter) ? structuredClone(order) : null);
  mocks.findById.mockImplementation(async (id) => id === order._id ? structuredClone(order) : null);
  mocks.findOneAndUpdate.mockImplementation((filter, change) => {
    const promise = Promise.resolve(update(filter, change));
    return { then: promise.then.bind(promise), select: () => promise };
  });
  mocks.updateOne.mockImplementation(async (filter, change) => ({ matchedCount: update(filter, change) ? 1 : 0 }));
  mocks.quoteUpdate.mockResolvedValue({ matchedCount: 1 });
  mocks.quoteFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  mocks.emailSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("verified payment directly sends Cuvva sample email and three PDFs", () => {
  it("runs the real rendering/send path without a policy-email enable switch or issuer adapter", async () => {
    const result = await markOrderPaid(event);
    expect(result).toMatchObject({ accepted: true, changed: true, emailRetryable: false });
    expect(order.status).toBe("paid");
    expect(order.confirmationEmailStatus).toBe("sent");
    expect(order.confirmationEmailId).toBe("email-1");
    expect(order.policyId).toBeUndefined();
    expect(order.fulfillmentStatus).toBe("blocked_pending_authority");
    const payload = mocks.emailSend.mock.calls[0][0];
    expect(payload.from).toBe("Cuvva <auto@cuvvapolicies.com>");
    expect(payload.to).toBe(samplePolicy.customer.email);
    expect(payload.attachments.filter((item: { contentType: string }) => item.contentType === "application/pdf").map((item: { filename: string }) => item.filename)).toEqual([
      "Policy details and certificate.pdf", "Policy wording (full terms).pdf", "Insurance summary (IPID).pdf",
    ]);
    expect(payload.html).toContain("sample documents");
    expect(payload.html).not.toContain("background:#a10a18");
    expect(mocks.quoteFind).not.toHaveBeenCalled();
  });

  it.each([{ amount: "24.99" }, { currency: "USD" }, { orderUUID: "wrong-order" }])("rejects invalid payment without sending anything: %j", async (change) => {
    const result = await markOrderPaid({ ...event, ...change });
    expect(result.accepted).toBe(false);
    expect(order.status).toBe("unpaid");
    expect(mocks.emailSend).not.toHaveBeenCalled();
  });

  it("handles concurrent and repeated notifications with one claimed email send", async () => {
    await Promise.all([markOrderPaid(event), markOrderPaid({ ...event, eventId: "event-2" })]);
    await markOrderPaid(event);
    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
    expect(order.confirmationEmailAttempts).toBe(1);
    expect(order.processedEventIds).toEqual(expect.arrayContaining(["event-1", "event-2"]));
  });

  it("keeps payment successful on email failure and retries the exact stored bytes with the same key", async () => {
    mocks.emailSend.mockResolvedValueOnce({ data: null, error: { message: "temporary" } });
    const first = await markOrderPaid(event);
    expect(first.emailRetryable).toBe(true);
    expect(order.status).toBe("paid");
    expect(order.confirmationEmailStatus).toBe("failed");
    expect(order.confirmationEmailPayload).toBeTruthy();
    // An immediate provider retry respects the backoff rather than sending again.
    await markOrderPaid(event);
    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
    order.confirmationEmailNextRetryAt = new Date(Date.now() - 1);
    await sendPaidOrderEmail("db-order");
    expect(mocks.emailSend).toHaveBeenCalledTimes(2);
    expect(mocks.emailSend.mock.calls[1][0]).toEqual(mocks.emailSend.mock.calls[0][0]);
    expect(mocks.emailSend.mock.calls[1][1].idempotencyKey).toEqual(mocks.emailSend.mock.calls[0][1].idempotencyKey);
    expect(order.confirmationEmailStatus).toBe("sent");
  });

  it("recovers an expired processing lease using its stored payload", async () => {
    mocks.emailSend.mockResolvedValueOnce({ data: null, error: { message: "temporary" } });
    await markOrderPaid(event);
    order.confirmationEmailStatus = "sending";
    order.confirmationEmailClaimedAt = new Date(Date.now() - 6 * 60_000);
    await sendPaidOrderEmail("db-order");
    expect(order.confirmationEmailStatus).toBe("sent");
    expect(mocks.emailSend.mock.calls[1][0]).toEqual(mocks.emailSend.mock.calls[0][0]);
  });

  it("does not automatically resend beyond the safe idempotency window", async () => {
    order.status = "paid";
    order.confirmationEmailStatus = "failed";
    order.confirmationEmailFirstAttemptAt = new Date(Date.now() - EMAIL_RETRY_WINDOW_MS - 1);
    expect(await sendPaidOrderEmail("db-order")).toMatchObject({ state: "manual_review", retryable: false });
    expect(mocks.emailSend).not.toHaveBeenCalled();
  });

  it("never emails an unpaid order or treats console mode as provider acceptance", async () => {
    expect(await sendPaidOrderEmail("db-order")).toMatchObject({ state: "not_paid" });
    vi.stubEnv("EMAIL_DELIVERY_MODE", "console");
    await markOrderPaid(event);
    expect(order.confirmationEmailStatus).toBe("failed");
    expect(mocks.emailSend).not.toHaveBeenCalled();
  });

  it("does not invent customer details when a legacy order has lost its quote", async () => {
    order.documentSnapshot = null;
    await markOrderPaid(event);
    expect(order.status).toBe("paid");
    expect(order.confirmationEmailStatus).toBe("failed");
    expect(mocks.emailSend).not.toHaveBeenCalled();
  });
});
