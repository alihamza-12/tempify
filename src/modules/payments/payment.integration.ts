import { randomUUID, createHmac, createHash } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: auth.session }));

import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models/Order";
import { Quote } from "@/models/Quote";
import { User } from "@/models/User";
import { POST as checkout } from "../../app/api/checkout/route";
import { POST as webhook } from "../../app/api/webhooks/paymegate/route";
import { GET as status } from "../../app/api/orders/[id]/route";

type Remote = { orderUUID: string; externalId: string; amount: string; currency: string; status: string; checkoutUrl: string; paidTransactionUUID?: string; paidAt?: string; forced?: boolean };
let mongo: MongoMemoryServer;
let customerId: mongoose.Types.ObjectId;
let createCalls = 0;
let emailCalls = 0;
let deliveries = 0;
let providerTimesOut = false;
let providerBadUrl = false;
let emailFailures = 0;
const remoteOrders = new Map<string, Remote>();
const messages = new Map<string, { hash: string; payload: Record<string, unknown> }>();

beforeAll(async () => {
  // Never read the user's MONGODB_URI or credentials. Always start our own local DB.
  mongo = await MongoMemoryServer.create({ instance: { dbName: "tempify_payment_audit", ip: "127.0.0.1" }, binary: { version: "7.0.14" } });
  vi.stubEnv("MONGODB_URI", mongo.getUri("tempify_payment_audit"));
  vi.stubEnv("PAYMEGATE_API_KEY", "audit-only-not-live");
  vi.stubEnv("PAYMEGATE_BASE_URL", "https://payment-audit.invalid");
  vi.stubEnv("PAYMEGATE_WEBHOOK_SECRET", "audit-signature-not-live");
  vi.stubEnv("RESEND_API_KEY", "re_audit_not_live");
  vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
  vi.stubEnv("PAYMENT_EMAIL_FROM", "Cuvva <auto@cuvvapolicies.com>");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.invalid");
  await connectToDatabase();
  expect(mongoose.connection.name).toBe("tempify_payment_audit");
  await Promise.all([Order.init(), Quote.init(), User.init()]);

  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === "https://payment-audit.invalid/v1/orders" && init?.method === "POST") {
      createCalls += 1;
      const id = randomUUID();
      const remote: Remote = { orderUUID: id, externalId: body.externalId, amount: body.amount, currency: body.currency, status: "UNPAID", checkoutUrl: providerBadUrl ? "https://unexpected.example.invalid/pay" : `https://www.paymegate.com/pay/${id}` };
      remoteOrders.set(id, remote);
      // Allow two checkout requests to overlap while the first provider call runs.
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (providerTimesOut) throw new Error("Simulated timeout after provider created the order");
      return Response.json({ success: true, data: remote }, { status: 201 });
    }
    if (url.startsWith("https://payment-audit.invalid/v1/orders/")) {
      const remote = remoteOrders.get(url.split("/").pop()!);
      return Response.json({ success: Boolean(remote), data: remote }, { status: remote ? 200 : 404 });
    }
    if (url === "https://api.resend.com/emails") {
      emailCalls += 1;
      if (emailFailures > 0) { emailFailures -= 1; return Response.json({ name: "application_error", message: "Simulated outage" }, { status: 503 }); }
      const key = new Headers(init?.headers).get("idempotency-key");
      expect(key).toBeTruthy();
      const hash = createHash("sha256").update(String(init?.body)).digest("hex");
      const old = messages.get(key!);
      if (old) expect(hash).toBe(old.hash);
      else { messages.set(key!, { hash, payload: body }); deliveries += 1; }
      return Response.json({ id: `audit-message-${key}` });
    }
    throw new Error(`BLOCKED: audit cannot access external network: ${new URL(url).origin}`);
  });
});

beforeEach(async () => {
  expect(mongoose.connection.name).toBe("tempify_payment_audit");
  await Promise.all([Order.deleteMany({}), Quote.deleteMany({}), User.deleteMany({})]);
  createCalls = emailCalls = deliveries = 0;
  providerTimesOut = providerBadUrl = false;
  emailFailures = 0;
  remoteOrders.clear(); messages.clear();
  customerId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({ _id: customerId, email: "audit@example.invalid", fullName: "Audit Customer", role: "Customer", status: "Active" });
  auth.session.mockResolvedValue({ userId: String(customerId), email: "audit@example.invalid", role: "Customer" });
  vi.stubEnv("LIVE_POLICY_CHECKOUT_ENABLED", "true"); // Only in this fake-provider test process.
});

afterAll(async () => {
  if (mongoose.connection.name === "tempify_payment_audit") await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

async function quote() {
  return Quote.create({
    publicId: randomUUID(), userId: customerId, vehicleId: new mongoose.Types.ObjectId(),
    driver: { title: "Mx", firstName: "Audit", lastName: "Customer", email: "audit@example.invalid", dateOfBirth: new Date("1990-01-02"), gender: "Other", occupation: "Tester", phone: "00000000000" },
    vehicle: { registration: "SAMPLE1", make: "Example", model: "Test Car", colour: "Blue", year: 2020, vehicleIdentificationNumber: "SAMPLEVIN000000001", source: "regcheck", verifiedAt: new Date() },
    cover: { startAt: new Date("2030-01-01T10:00:00Z"), endAt: new Date("2030-01-01T12:00:00Z"), durationUnit: "hours", durationValue: 2 },
    address: { line1: "1 Sample Road", city: "London", postcode: "AB1 2CD", country: "GB" },
    licence: { number: "SAMPLE12345678", type: "Full UK", heldFor: "5-10 Years", vehicleValue: "5000", reasonForCover: "Borrowing" },
    pricing: { amount: 25, currency: "GBP" }, status: "draft", expiresAt: new Date(Date.now() + 86_400_000),
  });
}
const requestCheckout = (id: string) => checkout(new Request("https://app.example.invalid/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: id }) }));
async function createOrder() {
  const q = await quote();
  const response = await requestCheckout(q.publicId);
  expect(response.status, await response.clone().text()).toBe(201);
  const local = await Order.findOne({ quoteId: q._id });
  expect(local).toBeTruthy();
  return { q, local: local!, remote: remoteOrders.get(local!.paymegateOrderUUID)! };
}
function paidRequest(remote: Remote, overrides: Record<string, unknown> = {}, age = 0) {
  const event = { id: randomUUID(), type: "order.paid", createdAt: new Date().toISOString(), orderUUID: remote.orderUUID, transactionUUID: randomUUID(), status: "PAID", amount: remote.amount, currency: remote.currency, customerEmail: "audit@example.invalid", externalId: remote.externalId, metadata: {}, paidAt: new Date().toISOString(), ...overrides };
  const raw = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  const signature = createHmac("sha256", "audit-signature-not-live").update(`${timestamp}.${raw}`).digest("base64url");
  return new Request("https://app.example.invalid/api/webhooks/paymegate", { method: "POST", body: raw, headers: { "x-paymegate-event": "order.paid", "x-paymegate-event-id": event.id, "x-paymegate-timestamp": timestamp, "x-paymegate-signature": signature } });
}

describe("isolated MongoDB + real application routes; external APIs intercepted", () => {
  it("checkout -> signed paid webhook -> three-PDF email, even after the original quote is deleted", async () => {
    const { q, local, remote } = await createOrder();
    await Quote.deleteOne({ _id: q._id });
    expect((await webhook(paidRequest(remote))).status).toBe(200);
    const updated = await Order.findById(local._id);
    expect(updated?.status).toBe("paid"); expect(updated?.confirmationEmailStatus).toBe("sent");
    expect(updated?.policyId).toBeNull(); expect(deliveries).toBe(1);
    const payload = [...messages.values()][0].payload;
    expect(payload.from).toBe("Cuvva <auto@cuvvapolicies.com>");
    expect(payload.to).toBe("audit@example.invalid");
    expect(String(payload.html)).toContain("SAMPLE");
    expect((payload.attachments as { content_type: string }[]).filter((item) => item.content_type === "application/pdf")).toHaveLength(3);
    expect(updated?.confirmationEmailPayload).toBeUndefined(); // Not exposed by ordinary projections.
  });
  it("three concurrent paid notifications produce one submitted email", async () => {
    const { local, remote } = await createOrder();
    await Promise.all(Array.from({ length: 3 }, () => webhook(paidRequest(remote))));
    expect(deliveries).toBe(1);
    expect((await Order.findById(local._id))?.confirmationEmailStatus).toBe("sent");
  });
  it("wrong amount, stale signatures and unsigned bodies cannot mark paid or send", async () => {
    const { local, remote } = await createOrder();
    expect((await webhook(paidRequest(remote, { amount: "24.00" }))).status).toBe(409);
    expect((await webhook(paidRequest(remote, {}, 600))).status).toBe(401);
    expect((await webhook(new Request("https://example.invalid", { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await Order.findById(local._id))?.status).toBe("unpaid"); expect(emailCalls).toBe(0);
  });
  it("email failure keeps money marked paid and later retry sends one identical cached payload", async () => {
    const { local, remote } = await createOrder(); emailFailures = 1;
    expect((await webhook(paidRequest(remote))).status).toBe(503);
    const before = await Order.findById(local._id).select("+confirmationEmailPayload");
    expect(before?.status).toBe("paid"); expect(before?.confirmationEmailStatus).toBe("failed");
    await Order.updateOne({ _id: local._id }, { $set: { confirmationEmailNextRetryAt: new Date(Date.now() - 1) } });
    expect((await webhook(paidRequest(remote))).status).toBe(200);
    const after = await Order.findById(local._id).select("+confirmationEmailPayload");
    expect(after?.confirmationEmailPayload).toEqual(before?.confirmationEmailPayload);
    expect(deliveries).toBe(1); expect(emailCalls).toBe(2);
  });
  it("a repeat checkout reuses its existing unpaid link instead of failing after draft changed", async () => {
    const { q, local } = await createOrder();
    const response = await requestCheckout(q.publicId);
    expect(response.status).toBe(200);
    expect((await response.json()).orderId).toBe(local.publicId);
    expect(createCalls).toBe(1);
  });
  it("two simultaneous checkout requests cannot create two chargeable orders", async () => {
    const q = await quote();
    const results = await Promise.all([requestCheckout(q.publicId), requestCheckout(q.publicId)]);
    expect(results.some((response: Response) => response.status === 201)).toBe(true);
    expect(createCalls).toBe(1);
    expect(await Order.countDocuments({ quoteId: q._id })).toBe(1);
  });
  it("ambiguous provider timeout preserves a local reference and blocks blind recreation", async () => {
    const q = await quote(); providerTimesOut = true;
    expect((await requestCheckout(q.publicId)).status).toBeGreaterThanOrEqual(400);
    expect(await Order.countDocuments({ quoteId: q._id })).toBe(1);
    await requestCheckout(q.publicId);
    expect(createCalls).toBe(1);
  });
  it("rejects an unexpected checkout destination", async () => {
    const q = await quote(); providerBadUrl = true;
    expect((await requestCheckout(q.publicId)).status).toBeGreaterThanOrEqual(400);
  });
  it("manually forced PAID without a provider transaction is not proof of received money", async () => {
    const { local, remote } = await createOrder();
    Object.assign(remote, { status: "PAID", forced: true, paidAt: new Date().toISOString() });
    const response = await status(new Request("https://app.example.invalid"), { params: Promise.resolve({ id: local.publicId }) });
    expect((await response.json()).status).toBe("unpaid"); expect(emailCalls).toBe(0);
  });
  it("a signed paid event with no transaction evidence is not accepted as settled funds", async () => {
    const { local, remote } = await createOrder();
    expect((await webhook(paidRequest(remote, { transactionUUID: undefined }))).status).toBeGreaterThanOrEqual(400);
    expect((await Order.findById(local._id))?.status).toBe("unpaid"); expect(emailCalls).toBe(0);
  });
  it("provider reconciliation also sends the email when a signed webhook is missed", async () => {
    const { local, remote } = await createOrder();
    Object.assign(remote, { status: "PAID", paidTransactionUUID: randomUUID(), paidAt: new Date().toISOString() });
    const response = await status(new Request("https://app.example.invalid"), { params: Promise.resolve({ id: local.publicId }) });
    const body = await response.json();
    expect(body.status).toBe("paid"); expect(body.confirmationEmailStatus).toBe("sent");
    expect(body.policyIssued).toBe(false); expect(deliveries).toBe(1);
  });
  it("rejects an unsigned change to the signed event identity", async () => {
    const { local, remote } = await createOrder();
    const request = paidRequest(remote);
    request.headers.set("x-paymegate-event-id", randomUUID());
    expect((await webhook(request)).status).toBe(400);
    expect((await Order.findById(local._id))?.status).toBe("unpaid"); expect(emailCalls).toBe(0);
  });
  it("customer A cannot read customer B's order", async () => {
    const { local } = await createOrder();
    auth.session.mockResolvedValue({ userId: String(new mongoose.Types.ObjectId()), email: "other@example.invalid", role: "Customer" });
    expect((await status(new Request("https://app.example.invalid"), { params: Promise.resolve({ id: local.publicId }) })).status).toBe(404);
  });
  it("false live gate never calls the payment provider", async () => {
    const q = await quote(); vi.stubEnv("LIVE_POLICY_CHECKOUT_ENABLED", "false");
    expect((await requestCheckout(q.publicId)).status).toBe(503);
    expect(createCalls).toBe(0); expect(await Order.countDocuments()).toBe(0);
  });
});
