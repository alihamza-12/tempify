type PayMeGateOrder = {
  orderUUID: string;
  externalId: string | null;
  status: "UNPAID" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
  amount: string;
  currency: string;
  checkoutUrl: string;
  transactionRef?: string | null;
  paidTransactionUUID?: string;
  paidAt?: string;
};

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
      description: "Tempify vehicle cover",
      metadata: input.metadata,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.checkoutUrl) {
    console.error("[paymegate:create]", response.status, body?.error?.code || "unknown");
    throw new PaymentProviderError(
      "Secure payment is temporarily unavailable. Please try again.",
      response.status,
    );
  }
  return body.data as PayMeGateOrder;
}

export async function getPayMeGateOrder(orderUUID: string) {
  const { apiKey, baseUrl } = configuration();
  const response = await fetch(`${baseUrl}/v1/orders/${encodeURIComponent(orderUUID)}`, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data) {
    throw new PaymentProviderError("Payment status is temporarily unavailable.", response.status);
  }
  return body.data as PayMeGateOrder;
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
