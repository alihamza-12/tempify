import { NextResponse } from "next/server";
import { markOrderPaid } from "@/modules/payments/fulfillment";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.warn("[stripe:webhook] missing stripe-signature header");
    return NextResponse.json({ received: false, error: "Missing signature" }, { status: 401 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!webhookSecret || !secretKey) {
    console.error("[stripe:webhook] STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY not configured");
    return NextResponse.json({ received: false, error: "Webhook not configured" }, { status: 503 });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(secretKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: "2025-02-24.acacia" as any,
    });
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe:webhook] signature verification failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ received: false, error: "Invalid signature" }, { status: 401 });
  }

  // Handle only checkout.session.completed and payment_intent.succeeded
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only handle paid sessions
      if (session.payment_status !== "paid") {
        console.warn("[stripe:webhook] session not paid", session.id, session.payment_status);
        return NextResponse.json({ received: true, handled: false });
      }

      const externalId = session.metadata?.externalId;
      const amountTotal = session.amount_total;
      const currency = session.currency?.toUpperCase();
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

      if (!externalId || !amountTotal || !currency) {
        console.warn("[stripe:webhook] missing required fields", { externalId, amountTotal, currency });
        return NextResponse.json({ received: false, error: "Missing required fields" }, { status: 400 });
      }

      if (currency !== "GBP") {
        console.warn("[stripe:webhook] unsupported currency", currency);
        return NextResponse.json({ received: false, error: "Unsupported currency" }, { status: 400 });
      }

      const amount = (amountTotal / 100).toFixed(2);

      const payment = {
        externalId,
        eventId: event.id,
        orderUUID: session.id,
        transactionUUID: paymentIntentId || session.id,
        transactionRef: paymentIntentId || undefined,
        paidAt: new Date(event.created * 1000).toISOString(),
        amount,
        currency: currency as "GBP",
      };

      const result = await markOrderPaid(payment);
      if (!result.accepted) {
        return NextResponse.json({ received: false, error: "Payment could not be matched." }, { status: 409 });
      }
      if (result.emailRetryable) {
        return NextResponse.json({ received: true, emailPending: true }, { status: 503 });
      }
      return NextResponse.json({ received: true });
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Try to find order by payment intent ID if we store it
      // For now, we handle via checkout.session.completed, so just ack
      console.log("[stripe:webhook] payment_intent.succeeded", paymentIntent.id);
      return NextResponse.json({ received: true, handled: false });
    }

    // For other event types, just acknowledge
    console.log(`[stripe:webhook] unhandled event type: ${event.type}`);
    return NextResponse.json({ received: true, handled: false });
  } catch (error) {
    console.error("[stripe:webhook] processing failed", error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

// GET for testing webhook endpoint existence (Stripe doesn't use GET, but useful for health check)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Stripe webhook endpoint is active. Use POST with Stripe signature.",
    configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY),
  });
}
