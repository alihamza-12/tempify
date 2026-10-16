import { z } from "zod";
import { gbpPence } from "./validation";

const providerOrderSchema = z.object({
  orderUUID: z.uuid(),
  externalId: z.string().nullable(),
  status: z.enum(["UNPAID", "PAID", "FAILED", "EXPIRED", "CANCELLED"]),
  amount: z.string(), currency: z.string().regex(/^[A-Z]{3}$/),
  checkoutUrl: z.url(), transactionRef: z.string().nullable().optional(),
  paidTransactionUUID: z.uuid().optional(), paidAt: z.iso.datetime({ offset: true }).optional(),
  forced: z.boolean().optional(),
});

function isHostedCheckout(url: string, orderUUID: string) {
  const parsed = new URL(url);
  return parsed.protocol === "https:" &&
    ["www.paymegate.com", "paymegate.com"].includes(parsed.hostname) &&
    !parsed.username && !parsed.password && !parsed.port && !parsed.hash &&
    parsed.pathname === `/pay/${orderUUID}`;
}

function configuration() {
  const apiKey = process.env.PAYMEGATE_API_KEY?.trim();
  if (!apiKey) {
    console.error("[payment] PAYMEGATE_API_KEY is not configured");
    throw new PaymentConfigurationError("Online payment is temporarily unavailable. Please try again later.");
  }
  return {
    apiKey,
    baseUrl: (process.env.PAYMEGATE_BASE_URL || "https://api.paymegate.com").replace(/\/$/, ""),
  };
}

export async function createPayMeGateOrder(input: {
  externalId: string;
  amount: string;
  currency: string;
  backUrl: string;
  email: string;
  fullName: string;
  metadata: Record<string, string>;
}) {
  const { apiKey, baseUrl } = configuration();
  const response = await fetch(`${baseUrl}/v1/orders`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      externalId: input.externalId,
      amount: input.amount,
      currency: input.currency,
      paymentMethodsKeys: ["*"],
      backUrl: input.backUrl,
      customer: { email: input.email, fullName: input.fullName },
      description: "Cuvvafy vehicle cover",
      metadata: input.metadata,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const body = await response.json().catch(() => null);
  const parsed = providerOrderSchema.safeParse(body?.data);
  if (!response.ok || body?.success !== true || !parsed.success) {
    console.error("[paymegate:create]", response.status, body?.error?.code || "unknown");
    throw new PaymentProviderError(
      "Secure payment is temporarily unavailable. Please try again.",
      response.status,
    );
  }
  const order = parsed.data;
  if (order.status !== "UNPAID" || order.externalId !== input.externalId ||
      order.currency !== input.currency || input.currency !== "GBP" ||
      gbpPence(input.amount) === null || gbpPence(order.amount) !== gbpPence(input.amount) ||
      !isHostedCheckout(order.checkoutUrl, order.orderUUID)) {
    throw new PaymentProviderError("Unexpected payment-provider response. Checkout needs review.");
  }
  return order;
}

export async function getPayMeGateOrder(orderUUID: string) {
  const { apiKey, baseUrl } = configuration();
  const response = await fetch(`${baseUrl}/v1/orders/${encodeURIComponent(orderUUID)}`, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null);
  const parsed = providerOrderSchema.safeParse(body?.data);
  if (!response.ok || body?.success !== true || !parsed.success || parsed.data.orderUUID !== orderUUID) {
    throw new PaymentProviderError("Payment status is temporarily unavailable.", response.ok ? 502 : response.status);
  }
  return parsed.data;
}

export function mapPaymentStatus(status: string) {
  const value = String(status || "").toLowerCase();
  return ["paid", "failed", "expired", "cancelled"].includes(value) ? value : "unpaid";
}

export class PaymentConfigurationError extends Error {
  status = 503;
}

export class PaymentProviderError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}
