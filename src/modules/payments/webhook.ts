import Stripe from "stripe";

// PayMeGate legacy verification (kept for backward compatibility, but deprecated)
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPayMeGateWebhook(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}) {
  const secret = process.env.PAYMEGATE_WEBHOOK_SECRET;
  if (!secret || !input.signature || !input.timestamp) return false;

  if (!/^\d+$/.test(input.timestamp)) return false;
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("base64url");

  const suppliedBuffer = Buffer.from(input.signature);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

// Stripe webhook verification
export function verifyStripeWebhook(input: {
  rawBody: string;
  signature: string | null;
}) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("[stripe:webhook] STRIPE_WEBHOOK_SECRET not configured");
    return { valid: false, event: null as Stripe.Event | null, error: "Webhook secret not configured" };
  }
  if (!input.signature) {
    return { valid: false, event: null as Stripe.Event | null, error: "Missing signature" };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() || "", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: "2025-02-24.acacia" as any,
    });
    const event = stripe.webhooks.constructEvent(input.rawBody, input.signature, webhookSecret);
    return { valid: true, event, error: null };
  } catch (error) {
    console.error("[stripe:webhook] signature verification failed", error instanceof Error ? error.message : "unknown");
    return { valid: false, event: null as Stripe.Event | null, error: error instanceof Error ? error.message : "Invalid signature" };
  }
}

// New primary verification for Stripe
export function constructStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  if (!signature) {
    throw new Error("Missing Stripe signature");
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() || "", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2025-02-24.acacia" as any,
  });
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
