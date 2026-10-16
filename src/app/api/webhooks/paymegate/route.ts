import { paidPaymentSchema } from "@/modules/payments/validation";
import { NextResponse } from "next/server";
import { markOrderPaid } from "@/modules/payments/fulfillment";
import { verifyPayMeGateWebhook } from "@/modules/payments/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paymegate-signature");
  const timestamp = request.headers.get("x-paymegate-timestamp");
  const eventType = request.headers.get("x-paymegate-event");
  const eventIdHeader = request.headers.get("x-paymegate-event-id");

  const valid = eventType === "order.paid" && verifyPayMeGateWebhook({ rawBody, signature, timestamp });
  if (!valid) {
    console.warn("[paymegate:webhook] rejected signature or event type");
    return NextResponse.json({ received: false }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody);
    if (!event || event.type !== "order.paid" || event.status !== "PAID" || !event.externalId) {
      return NextResponse.json({ received: false });
    }

    if (!eventIdHeader || eventIdHeader !== event.id || event.forced === true) {
      return NextResponse.json({ received: false, error: "Payment event identity is invalid." }, { status: 400 });
    }
    const payment = paidPaymentSchema.safeParse({
      externalId: event.externalId,
      eventId: eventIdHeader || event.id,
      orderUUID: event.orderUUID,
      transactionUUID: event.transactionUUID,
      transactionRef: event.transactionRef,
      paidAt: event.paidAt,
      amount: event.amount,
      currency: event.currency,
    });
    if (!payment.success) {
      return NextResponse.json({ received: false, error: "Invalid payment event." }, { status: 400 });
    }
    const result = await markOrderPaid(payment.data);
    if (!result.accepted) {
      // Do not acknowledge a mismatched or not-yet-persisted order as processed.
      return NextResponse.json({ received: false, error: "Payment could not be matched." }, { status: 409 });
    }
    if (result.emailRetryable) {
      return NextResponse.json({ received: true, emailPending: true }, { status: 503 });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[paymegate:webhook] processing failed", error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
