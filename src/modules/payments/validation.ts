import { z } from "zod";

const identifier = z.string().min(1).max(200);

export const paidPaymentSchema = z.object({
  externalId: identifier,
  eventId: identifier,
  orderUUID: identifier,
  // Provider-settled events carry this UUID; manually forced paid events do not.
  // For Stripe: payment_intent ID or session ID
  transactionUUID: z.string().min(1).max(200),
  transactionRef: z.string().max(500).nullable().optional(),
  paidAt: z.iso.datetime({ offset: true }).optional(),
  amount: z.string().min(1).max(100),
  currency: z.literal("GBP"),
});

export type PaidPayment = z.infer<typeof paidPaymentSchema>;

type StoredPayment = {
  publicId: string;
  paymegateOrderUUID?: string | null;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  amount: number;
  currency: string;
};

// Tempify currently prices in GBP. Compare exact pence, never rounded floats.
// Extra decimal places are accepted only if they are zero (e.g. 10.0000).
export function gbpPence(value: string | number): number | null {
  const match = /^(\d{1,14})(?:\.(\d{1,2})(0*))?$/.exec(String(value));
  if (!match) return null;
  const pence = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(pence) && pence > 0 ? pence : null;
}

export function matchesStoredPayment(
  order: StoredPayment,
  payment: { externalId: unknown; orderUUID: unknown; amount: unknown; currency: unknown },
): boolean {
  // Support both Stripe (stripeSessionId) and legacy PayMeGate (paymegateOrderUUID)
  const hasStripeId = Boolean(order.stripeSessionId);
  const hasPayMeGateId = Boolean(order.paymegateOrderUUID);
  
  if (!hasStripeId && !hasPayMeGateId) return false;

  // Check Stripe session ID match
  if (hasStripeId) {
    if (payment.orderUUID !== order.stripeSessionId) return false;
  } else if (hasPayMeGateId) {
    // Legacy PayMeGate check
    if (payment.orderUUID !== order.paymegateOrderUUID) return false;
  }

  if (
    payment.externalId !== order.publicId ||
    order.currency !== "GBP" ||
    payment.currency !== order.currency ||
    typeof payment.amount !== "string"
  )
    return false;

  const expected = gbpPence(order.amount);
  return expected !== null && gbpPence(payment.amount) === expected;
}
