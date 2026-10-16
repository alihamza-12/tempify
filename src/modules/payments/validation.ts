import { z } from "zod";

const identifier = z.string().min(1).max(200);

export const paidPaymentSchema = z.object({
  externalId: identifier,
  eventId: identifier,
  orderUUID: identifier,
  // Provider-settled events carry this UUID; manually forced paid events do not.
  transactionUUID: z.uuid(),
  transactionRef: z.string().max(500).nullable().optional(),
  paidAt: z.iso.datetime({ offset: true }).optional(),
  amount: z.string().min(1).max(100),
  currency: z.literal("GBP"),
});

export type PaidPayment = z.infer<typeof paidPaymentSchema>;

type StoredPayment = {
  publicId: string;
  paymegateOrderUUID?: string | null;
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
  if (
    !order.paymegateOrderUUID ||
    payment.orderUUID !== order.paymegateOrderUUID ||
    payment.externalId !== order.publicId ||
    order.currency !== "GBP" ||
    payment.currency !== order.currency ||
    typeof payment.amount !== "string"
  ) return false;

  const expected = gbpPence(order.amount);
  return expected !== null && gbpPence(payment.amount) === expected;
}
