import { randomUUID } from "node:crypto";
import { matchesStoredPayment, paidPaymentSchema } from "./validation";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models/Order";
import { Quote } from "@/models/Quote";
import { preparePaymentDocumentEmail, sendPaymentConfirmationEmail, type PreparedPaymentEmail } from "@/modules/email/service";
import { sampleDocumentInputFromQuote } from "@/modules/policy-documents/from-quote";
import { canRetryPaymentEmail, EMAIL_LEASE_MS, EMAIL_MAX_ATTEMPTS, EMAIL_RETRY_DELAY_MS, EMAIL_RETRY_WINDOW_MS } from "./email-retry";

export async function markOrderPaid(payload: unknown) {
  const parsed = paidPaymentSchema.safeParse(payload);
  if (!parsed.success) return { found: false, changed: false, accepted: false, emailRetryable: false };
  const input = parsed.data;
  await connectToDatabase();
  const order = await Order.findOne({ publicId: input.externalId });
  if (!order) return { found: false, changed: false, accepted: false, emailRetryable: false };
  if (!matchesStoredPayment(order, input)) {
    console.warn("[payment] order identity, amount or currency mismatch", input.externalId);
    return { found: true, changed: false, accepted: false, emailRetryable: false };
  }

  // Atomic transition: concurrent requests cannot reset paidAt or email state.
  // Support both Stripe (stripeSessionId) and legacy PayMeGate (paymegateOrderUUID)
  const filter: Record<string, unknown> = {
    _id: order._id,
    status: { $ne: "paid" },
    amount: order.amount,
    currency: input.currency,
  };
  
  // Check which payment provider ID to use
  if (order.stripeSessionId) {
    filter.stripeSessionId = input.orderUUID;
  } else if (order.paymegateOrderUUID) {
    filter.paymegateOrderUUID = input.orderUUID;
  } else {
    // Fallback: try both
    filter.$or = [
      { stripeSessionId: input.orderUUID },
      { paymegateOrderUUID: input.orderUUID },
    ];
    delete filter.stripeSessionId;
    delete filter.paymegateOrderUUID;
  }

  const changed = await Order.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "paid",
        transactionUUID: input.transactionUUID,
        stripePaymentIntentId: input.transactionUUID,
        transactionRef: input.transactionRef || undefined,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        fulfillmentStatus: "blocked_pending_authority",
      },
      $addToSet: { processedEventIds: input.eventId },
    },
    { new: true },
  );
  if (!changed) {
    await Order.updateOne({ _id: order._id, status: "paid" }, { $addToSet: { processedEventIds: input.eventId } });
  } else {
    try {
      await Quote.updateOne({ _id: order.quoteId }, { $set: { status: "paid", userId: order.userId } });
    } catch {
      console.warn("[payment] quote bookkeeping unavailable", order.publicId);
    }
  }
  const email = await sendPaidOrderEmail(String(order._id));
  return { found: true, changed: Boolean(changed), accepted: true, emailRetryable: email.retryable };
}

/** No extra email flag: every verified paid order reaches this function. */
export async function sendPaidOrderEmail(orderId: string) {
  const current = await Order.findById(orderId);
  if (!current || current.status !== "paid") return { state: "not_paid", retryable: false };
  if (current.confirmationEmailStatus === "sent") return { state: "sent", retryable: false };
  if (!canRetryPaymentEmail(current)) return { state: "manual_review", retryable: false };

  const now = new Date();
  const claim = randomUUID();
  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: "paid",
      $and: [
        {
          $or: [
            {
              confirmationEmailStatus: { $in: ["pending", "failed"] },
              $or: [
                { confirmationEmailNextRetryAt: { $exists: false } },
                { confirmationEmailNextRetryAt: null },
                { confirmationEmailNextRetryAt: { $lte: now } },
              ],
            },
            { confirmationEmailStatus: "sending", confirmationEmailClaimedAt: { $lte: new Date(now.getTime() - EMAIL_LEASE_MS) } },
          ],
        },
        { $or: [{ confirmationEmailAttempts: { $exists: false } }, { confirmationEmailAttempts: { $lt: EMAIL_MAX_ATTEMPTS } }] },
        {
          $or: [
            { confirmationEmailFirstAttemptAt: { $exists: false } },
            { confirmationEmailFirstAttemptAt: null },
            { confirmationEmailFirstAttemptAt: { $gt: new Date(now.getTime() - EMAIL_RETRY_WINDOW_MS) } },
          ],
        },
      ],
    },
    {
      $set: {
        confirmationEmailStatus: "sending",
        confirmationEmailClaim: claim,
        confirmationEmailClaimedAt: now,
        confirmationEmailFirstAttemptAt: current.confirmationEmailFirstAttemptAt || now,
        confirmationEmailError: null,
      },
      $inc: { confirmationEmailAttempts: 1 },
    },
    { new: true },
  ).select("+confirmationEmailPayload");
  if (!claimed) return { state: "pending", retryable: true };
  const ownedClaim = { _id: claimed._id, confirmationEmailClaim: claim, confirmationEmailStatus: "sending" };

  try {
    let payload = claimed.confirmationEmailPayload as PreparedPaymentEmail | null;
    if (!payload) {
      let snapshot = claimed.documentSnapshot;
      if (!snapshot) {
        const quote = await Quote.findById(claimed.quoteId).lean();
        if (!quote || String(quote.userId) !== String(claimed.userId)) throw new Error("Original order details are unavailable; manual review required.");
        snapshot = sampleDocumentInputFromQuote(quote, claimed);
      }
      payload = await preparePaymentDocumentEmail({
        orderId: claimed.publicId,
        email: claimed.customerEmail,
        amount: claimed.amount,
        currency: claimed.currency,
        documentSnapshot: snapshot,
      });
      const saved = await Order.updateOne(ownedClaim, { $set: { documentSnapshot: snapshot, confirmationEmailPayload: payload } });
      if (!saved.matchedCount) return { state: "pending", retryable: true };
    }
    const result = await sendPaymentConfirmationEmail({ orderId: claimed.publicId, payload });
    const saved = await Order.updateOne(ownedClaim, {
      $set: { confirmationEmailStatus: "sent", confirmationEmailId: result.id, confirmationEmailError: null },
      $unset: { confirmationEmailNextRetryAt: 1, confirmationEmailClaim: 1 },
    });
    return { state: saved.matchedCount ? "sent" : "pending", retryable: !saved.matchedCount };
  } catch {
    // Do not store raw provider errors: they can contain recipient data/secrets.
    await Order.updateOne(ownedClaim, {
      $set: {
        confirmationEmailStatus: "failed",
        confirmationEmailError: "Payment is confirmed; document email failed. Retry or contact support; do not pay again.",
        confirmationEmailNextRetryAt: new Date(Date.now() + EMAIL_RETRY_DELAY_MS),
      },
      $unset: { confirmationEmailClaim: 1 },
    });
    return { state: "failed", retryable: canRetryPaymentEmail(claimed) };
  }
}
