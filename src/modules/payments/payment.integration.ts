import { randomUUID, createHash } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: auth.session }));

// Mock Stripe
const stripeMocks = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
  checkoutSessionsRetrieve: vi.fn(),
  webhooksConstructEvent: vi.fn(),
}));

vi.mock("stripe", () => {
  return {
    default: class {
      checkout = {
        sessions: {
          create: stripeMocks.checkoutSessionsCreate,
          retrieve: stripeMocks.checkoutSessionsRetrieve,
        },
      };
      webhooks = {
        constructEvent: stripeMocks.webhooksConstructEvent,
      };
      paymentIntents = {
        retrieve: vi.fn(),
      };
    },
  };
});

import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models/Order";
import { Quote } from "@/models/Quote";
import { User } from "@/models/User";
import { POST as checkout } from "../../app/api/checkout/route";
import { POST as webhook } from "../../app/api/webhooks/stripe/route";
import { GET as status } from "../../app/api/orders/[id]/route";

type RemoteSession = {
  id: string;
  object: "checkout.session";
  amount_total: number;
  currency: string;
  status: string;
  payment_status: string;
  url: string;
  customer_email: string;
  metadata: Record<string, string>;
  payment_intent: string;
};

let mongo: MongoMemoryServer;
let customerId: mongoose.Types.ObjectId;
let createCalls = 0;
let emailCalls = 0;
let deliveries = 0;
let providerTimesOut = false;
let providerBadUrl = false;
let emailFailures = 0;
const remoteSessions = new Map<string, RemoteSession>();
const messages = new Map<string, { hash: string; payload: Record<string, unknown> }>();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { dbName: "tempify_payment_audit", ip: "127.0.0.1" }, binary: { version: "7.0.14" } });
  vi.stubEnv("MONGODB_URI", mongo.getUri("tempify_payment_audit"));
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_audit_only_not_live");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_audit_signature_not_live");
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_audit");
  vi.stubEnv("RESEND_API_KEY", "re_audit_not_live");
  vi.stubEnv("EMAIL_DELIVERY_MODE", "resend");
  vi.stubEnv("PAYMENT_EMAIL_FROM", "Cuvva <auto@cuvvapolicies.com>");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.invalid");
  await connectToDatabase();
  expect(mongoose.connection.name).toBe("tempify_payment_audit");
  await Promise.all([Order.init(), Quote.init(), User.init()]);

  // Mock Stripe checkout.sessions.create
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stripeMocks.checkoutSessionsCreate.mockImplementation(async (params: any) => {
    createCalls += 1;
    if (providerTimesOut) {
      const id = `cs_test_${randomUUID()}`;
      const session: RemoteSession = {
        id,
        object: "checkout.session",
        amount_total: params.line_items[0].price_data.unit_amount,
        currency: params.line_items[0].price_data.currency,
        status: "open",
        payment_status: "unpaid",
        url: providerBadUrl ? "https://unexpected.example.invalid/pay" : `https://checkout.stripe.com/c/pay/${id}`,
        customer_email: params.customer_email,
        metadata: params.metadata,
        payment_intent: `pi_${randomUUID()}`,
      };
      remoteSessions.set(id, session);
      await new Promise((resolve) => setTimeout(resolve, 30));
      throw new Error("Simulated timeout after provider created the order");
    }

    const id = `cs_test_${randomUUID()}`;
    const session: RemoteSession = {
      id,
      object: "checkout.session",
      amount_total: params.line_items[0].price_data.unit_amount,
      currency: params.line_items[0].price_data.currency,
      status: "open",
      payment_status: "unpaid",
      url: providerBadUrl ? "https://unexpected.example.invalid/pay" : `https://checkout.stripe.com/c/pay/${id}`,
      customer_email: params.customer_email,
      metadata: params.metadata,
      payment_intent: `pi_${randomUUID()}`,
    };
    remoteSessions.set(id, session);
    await new Promise((resolve) => setTimeout(resolve, 30));
    return session;
  });

  stripeMocks.checkoutSessionsRetrieve.mockImplementation(async (id: string) => {
    const session = remoteSessions.get(id);
    if (!session) throw new Error("Session not found");
    return session;
  });

  stripeMocks.webhooksConstructEvent.mockImplementation((rawBody: string) => {
    // Simple mock - parse rawBody as event
    const event = JSON.parse(rawBody);
    return event;
  });

  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://api.resend.com/emails") {
      emailCalls += 1;
      if (emailFailures > 0) {
        emailFailures -= 1;
        return Response.json({ name: "application_error", message: "Simulated outage" }, { status: 503 });
      }
      const key = new Headers(init?.headers).get("idempotency-key");
      expect(key).toBeTruthy();
      const hash = createHash("sha256").update(String(init?.body)).digest("hex");
      const old = messages.get(key!);
      if (old) expect(hash).toBe(old.hash);
      else {
        messages.set(key!, { hash, payload: JSON.parse(String(init?.body)) });
        deliveries += 1;
      }
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
  remoteSessions.clear();
  messages.clear();
  customerId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({ _id: customerId, email: "audit@example.invalid", fullName: "Audit Customer", role: "Customer", status: "Active" });
  auth.session.mockResolvedValue({ userId: String(customerId), email: "audit@example.invalid", role: "Customer" });
  vi.stubEnv("LIVE_POLICY_CHECKOUT_ENABLED", "true");
});

afterAll(async () => {
  if (mongoose.connection.name === "tempify_payment_audit") await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function quote() {
  return Quote.create({
    publicId: randomUUID(),
    userId: customerId,
    vehicleId: new mongoose.Types.ObjectId(),
    driver: { title: "Mx", firstName: "Audit", lastName: "Customer", email: "audit@example.invalid", dateOfBirth: new Date("1990-01-02"), gender: "Other", occupation: "Tester", phone: "00000000000" },
    vehicle: { registration: "SAMPLE1", make: "Example", model: "Test Car", colour: "Blue", year: 2020, vehicleIdentificationNumber: "SAMPLEVIN000000001", source: "regcheck", verifiedAt: new Date() },
    cover: { startAt: new Date("2030-01-01T10:00:00Z"), endAt: new Date("2030-01-01T12:00:00Z"), durationUnit: "hours", durationValue: 2 },
    address: { line1: "1 Sample Road", city: "London", postcode: "AB1 2CD", country: "GB" },
    licence: { number: "SAMPLE12345678", type: "Full UK", heldFor: "5-10 Years", vehicleValue: "5000", reasonForCover: "Borrowing" },
    pricing: { amount: 25, currency: "GBP" },
    status: "draft",
    expiresAt: new Date(Date.now() + 86_400_000),
  });
}

const requestCheckout = (id: string) =>
  checkout(
    new Request("https://app.example.invalid/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: id }),
    }),
  );

async function createOrder() {
  const q = await quote();
  const response = await requestCheckout(q.publicId);
  expect(response.status, await response.clone().text()).toBe(201);
  const local = await Order.findOne({ quoteId: q._id });
  expect(local).toBeTruthy();
  const sessionId = local!.stripeSessionId || local!.paymegateOrderUUID;
  return { q, local: local!, remote: remoteSessions.get(sessionId!)! };
}

function stripeWebhookRequest(session: RemoteSession, overrides: Record<string, unknown> = {}) {
  const event = {
    id: `evt_${randomUUID()}`,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: "paid",
        status: "complete",
        customer_email: session.customer_email,
        metadata: { ...session.metadata, ...overrides },
        payment_intent: session.payment_intent,
      },
    },
  };
  const raw = JSON.stringify(event);
  return new Request("https://app.example.invalid/api/webhooks/stripe", {
    method: "POST",
    body: raw,
    headers: {
      "stripe-signature": "test_signature",
      "Content-Type": "application/json",
    },
  });
}

describe("isolated MongoDB + real application routes; Stripe mocked", () => {
  it("checkout -> Stripe webhook -> three-PDF email, even after the original quote is deleted", async () => {
    const { q, local, remote } = await createOrder();
    await Quote.deleteOne({ _id: q._id });
    expect((await webhook(stripeWebhookRequest(remote))).status).toBe(200);
    const updated = await Order.findById(local._id);
    expect(updated?.status).toBe("paid");
    expect(updated?.confirmationEmailStatus).toBe("sent");
    expect(updated?.policyId).toBeNull();
    expect(deliveries).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = [...messages.values()][0].payload as any;
    expect(payload.from).toBe("Cuvva <auto@cuvvapolicies.com>");
    expect(payload.to).toBe("audit@example.invalid");
    expect(String(payload.html)).toContain("SAMPLE");
    expect((payload.attachments as { content_type: string }[]).filter((item) => item.content_type === "application/pdf")).toHaveLength(3);
    expect(updated?.confirmationEmailPayload).toBeUndefined();
  });

  it("three concurrent paid notifications produce one submitted email", async () => {
    const { local, remote } = await createOrder();
    await Promise.all(Array.from({ length: 3 }, () => webhook(stripeWebhookRequest(remote))));
    expect(deliveries).toBe(1);
    expect((await Order.findById(local._id))?.confirmationEmailStatus).toBe("sent");
  });

  it("wrong amount cannot mark paid", async () => {
    const { local, remote } = await createOrder();
    const wrongAmountSession = { ...remote, amount_total: 2400 }; // 24.00 instead of 25.00
    expect((await webhook(stripeWebhookRequest(wrongAmountSession))).status).toBe(409);
    expect((await Order.findById(local._id))?.status).toBe("unpaid");
    expect(emailCalls).toBe(0);
  });

  it("email failure keeps money marked paid and later retry sends one identical cached payload", async () => {
    const { local, remote } = await createOrder();
    emailFailures = 1;
    expect((await webhook(stripeWebhookRequest(remote))).status).toBe(503);
    const before = await Order.findById(local._id).select("+confirmationEmailPayload");
    expect(before?.status).toBe("paid");
    expect(before?.confirmationEmailStatus).toBe("failed");
    await Order.updateOne({ _id: local._id }, { $set: { confirmationEmailNextRetryAt: new Date(Date.now() - 1) } });
    expect((await webhook(stripeWebhookRequest(remote))).status).toBe(200);
    const after = await Order.findById(local._id).select("+confirmationEmailPayload");
    expect(after?.confirmationEmailPayload).toEqual(before?.confirmationEmailPayload);
    expect(deliveries).toBe(1);
    expect(emailCalls).toBe(2);
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
    const q = await quote();
    providerTimesOut = true;
    expect((await requestCheckout(q.publicId)).status).toBeGreaterThanOrEqual(400);
    expect(await Order.countDocuments({ quoteId: q._id })).toBe(1);
    await requestCheckout(q.publicId);
    expect(createCalls).toBe(1);
  });

  it("rejects an unexpected checkout destination", async () => {
    const q = await quote();
    providerBadUrl = true;
    expect((await requestCheckout(q.publicId)).status).toBeGreaterThanOrEqual(400);
  });

  it("customer A cannot read customer B's order", async () => {
    const { local } = await createOrder();
    auth.session.mockResolvedValue({ userId: String(new mongoose.Types.ObjectId()), email: "other@example.invalid", role: "Customer" });
    expect((await status(new Request("https://app.example.invalid"), { params: Promise.resolve({ id: local.publicId }) })).status).toBe(404);
  });

  it("false live gate never calls the payment provider", async () => {
    const q = await quote();
    vi.stubEnv("LIVE_POLICY_CHECKOUT_ENABLED", "false");
    expect((await requestCheckout(q.publicId)).status).toBe(503);
    expect(createCalls).toBe(0);
    expect(await Order.countDocuments()).toBe(0);
  });
});
