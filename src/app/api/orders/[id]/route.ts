import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Order } from "@/models/Order";
import { getStripeSession, mapPaymentStatus } from "@/modules/payments/stripe";
import { matchesStoredPayment } from "@/modules/payments/validation";
import { canRetryPaymentEmail } from "@/modules/payments/email-retry";
import { markOrderPaid, sendPaidOrderEmail } from "@/modules/payments/fulfillment";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  await connectToDatabase();
  const { id } = await context.params;
  const order = await Order.findOne({ publicId: id, userId: session.userId }).lean();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  // Reconcile with Stripe if unpaid and we have a session ID
  const sessionId = order.stripeSessionId || order.paymegateOrderUUID;
  if (order.status === "unpaid" && sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const remote = await getStripeSession(sessionId);
      // For Stripe, remote has different shape, adapt for matchesStoredPayment
      // Support both new Stripe shape (sessionId, metadata) and legacy test shape (orderUUID, externalId)
      const remoteAsLegacy = remote as unknown as { orderUUID?: string; externalId?: string };
      const remoteForValidation = {
        orderUUID: remoteAsLegacy.orderUUID || remote.sessionId,
        externalId: remoteAsLegacy.externalId || remote.metadata?.externalId || order.publicId,
        amount: remote.amount,
        currency: remote.currency,
      };
      if (!matchesStoredPayment(order, remoteForValidation)) {
        throw new Error("Provider response does not match the stored order.");
      }
      const status = mapPaymentStatus(remote.status);
      if (status === "paid") {
        await markOrderPaid({
          externalId: remote.metadata?.externalId || order.publicId,
          eventId: `reconcile:${remote.sessionId}`,
          orderUUID: remote.sessionId,
          transactionUUID: remote.paymentIntentId || remote.sessionId,
          transactionRef: remote.paymentIntentId,
          paidAt: new Date().toISOString(),
          amount: remote.amount,
          currency: remote.currency as "GBP",
        });
      } else if (status !== order.status) {
        await Order.updateOne({ _id: order._id, status: "unpaid" }, { $set: { status } });
      }
    } catch (error) {
      console.warn("[payment:status] remote reconciliation unavailable", error);
    }
  }

  if (order.status === "paid" && canRetryPaymentEmail(order)) {
    try {
      await sendPaidOrderEmail(String(order._id));
    } catch {
      console.warn("[payment:email] retry unavailable", order.publicId);
    }
  }

  // Re-read persisted state: a provider response alone is not proof that our
  // validation accepted payment. This also includes changes from a concurrent webhook.
  const latest = await Order.findOne({ publicId: id, userId: session.userId }).lean();
  if (!latest) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  return NextResponse.json(
    {
      orderId: latest.publicId,
      status: latest.status,
      amount: latest.amount,
      currency: latest.currency,
      paidAt: latest.paidAt || null,
      policyIssued: latest.fulfillmentStatus === "issued" && Boolean(latest.policyId),
      fulfillmentStatus: latest.fulfillmentStatus || (latest.status === "paid" ? "blocked_pending_authority" : "pending_payment"),
      confirmationEmailStatus: latest.confirmationEmailStatus || "pending",
      confirmationEmailRetryable: canRetryPaymentEmail(latest),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
