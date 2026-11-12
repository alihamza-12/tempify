import Stripe from "stripe";
import { gbpPence } from "./validation";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("[payment] STRIPE_SECRET_KEY is not configured");
    throw new PaymentConfigurationError("Online payment is temporarily unavailable. Please try again later.");
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: "2025-09-30.clover" as any,
      typescript: true,
    });
  }
  return stripeInstance;
}

export function stripeKeyModesMatch(secretKey: string, publishableKey?: string) {
  if (!publishableKey) return true;
  const secretMode = secretKey.startsWith("sk_test_") ? "test" : secretKey.startsWith("sk_live_") ? "live" : null;
  const publishableMode = publishableKey.startsWith("pk_test_") ? "test" : publishableKey.startsWith("pk_live_") ? "live" : null;
  return Boolean(secretMode && publishableMode && secretMode === publishableMode);
}

export function stripeKeyConfigurationIsConsistent(secretKey: string, publishableKeys: string[]) {
  const configured = publishableKeys.map((key) => key.trim()).filter(Boolean);
  return new Set(configured).size <= 1 && configured.every((key) => stripeKeyModesMatch(secretKey, key));
}

function configuration() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("[payment] STRIPE_SECRET_KEY is not configured");
    throw new PaymentConfigurationError("Online payment is temporarily unavailable. Please try again later.");
  }
  const publishableKeys = [
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    process.env.STRIPE_PUBLISHABLE_KEY || "",
  ];
  if (!stripeKeyConfigurationIsConsistent(secretKey, publishableKeys)) {
    console.error("[payment] Stripe secret/publishable keys are mismatched or conflicting");
    throw new PaymentConfigurationError("Payment is temporarily unavailable because the Stripe keys are mismatched.");
  }
  return { secretKey, publishableKey: publishableKeys.map((key) => key.trim()).find(Boolean) };
}

export async function createStripeCheckoutSession(input: {
  externalId: string;
  amount: string;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  email: string;
  fullName: string;
  metadata: Record<string, string>;
}) {
  const stripe = getStripe();
  // Validate config exists
  configuration();

  // Validate amount
  const pence = gbpPence(input.amount);
  if (pence === null) {
    throw new PaymentProviderError("Invalid payment amount.");
  }
  if (input.currency !== "GBP") {
    throw new PaymentProviderError("Only GBP currency is supported.");
  }

  // Validate URLs
  if (!input.successUrl.startsWith("https://") || !input.cancelUrl.startsWith("https://")) {
    throw new PaymentProviderError("Invalid redirect URLs.");
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await (stripe.checkout.sessions.create as any)({
      mode: "payment",
      payment_method_types: ["card"],
      branding_settings: {
        display_name: "Products",
      },
      customer_email: input.email,
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: {
              name: "Order",
              description: "Order payment",
            },
            unit_amount: pence,
          },
          quantity: 1,
        },
      ],
      metadata: {
        externalId: input.externalId,
        quoteId: input.metadata.quoteId || "",
        registration: input.metadata.registration || "",
        ...input.metadata,
      },
      success_url: `${input.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes expiry
      payment_intent_data: {
        statement_descriptor: "OTHERS",
        metadata: {
          externalId: input.externalId,
          quoteId: input.metadata.quoteId || "",
        },
      },
    });

    if (!session.id || !session.url) {
      throw new PaymentProviderError("Failed to create checkout session.");
    }

    // Never redirect a customer to a provider-controlled/unexpected host.
    if (!session.url.startsWith("https://checkout.stripe.com/")) {
      console.error("[stripe:create] rejected unexpected checkout host");
      throw new PaymentProviderError("Secure checkout could not be verified.");
    }

    // The provider-created amount and currency must exactly match the quote.
    if (session.amount_total !== pence || session.currency?.toUpperCase() !== "GBP") {
      console.error("[stripe:create] rejected amount/currency mismatch", {
        expected: { amount: pence, currency: "GBP" },
        got: { amount: session.amount_total, currency: session.currency },
      });
      throw new PaymentProviderError("The checkout amount could not be verified.");
    }

    return {
      sessionId: session.id,
      orderUUID: session.id, // For compatibility with existing validation (orderUUID = sessionId)
      checkoutUrl: session.url,
      amount: input.amount,
      currency: input.currency,
      status: "UNPAID",
      externalId: input.externalId,
    };
  } catch (error) {
    if (error instanceof PaymentConfigurationError || error instanceof PaymentProviderError) {
      throw error;
    }
    console.error("[stripe:create] failed", error instanceof Error ? error.message : "unknown");
    throw new PaymentProviderError("Secure payment is temporarily unavailable. Please try again.", 502);
  }
}

export async function getStripeSession(sessionId: string) {
  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session.id || session.id !== sessionId) {
      throw new PaymentProviderError("Payment session not found.", 404);
    }
    return {
      sessionId: session.id,
      orderUUID: session.id,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
      // Checkout completion is not proof of settlement (for example, delayed
      // payment methods can complete before funds settle). Only the provider's
      // explicit paid state is accepted as payment confirmation.
      status: mapStripeSessionStatus(session.payment_status, session.status),
      amount: session.amount_total ? (session.amount_total / 100).toFixed(2) : "0.00",
      currency: (session.currency || "gbp").toUpperCase(),
      checkoutUrl: session.url || "",
      customerEmail: session.customer_details?.email || session.customer_email || "",
      metadata: session.metadata || {},
    };
  } catch (error) {
    if (error instanceof PaymentConfigurationError || error instanceof PaymentProviderError) {
      throw error;
    }
    console.error("[stripe:retrieve] failed", error instanceof Error ? error.message : "unknown");
    throw new PaymentProviderError("Payment status is temporarily unavailable.", 502);
  }
}

export async function getStripePaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return intent;
  } catch (error) {
    console.error("[stripe:paymentIntent] failed", error instanceof Error ? error.message : "unknown");
    throw new PaymentProviderError("Payment intent not found.", 404);
  }
}

export function mapStripeSessionStatus(paymentStatus?: string | null, sessionStatus?: string | null) {
  if (paymentStatus?.toLowerCase() === "paid") return "PAID";
  if (sessionStatus?.toLowerCase() === "expired") return "EXPIRED";
  return "UNPAID";
}

export function mapPaymentStatus(status: string) {
  const value = String(status || "").toLowerCase();
  if (["paid", "complete", "succeeded"].includes(value)) return "paid";
  if (["failed", "canceled", "cancelled"].includes(value)) return "failed";
  if (["expired"].includes(value)) return "expired";
  return "unpaid";
}

// Compatibility alias for old code that imports createPayMeGateOrder / getPayMeGateOrder
export const createPayMeGateOrder = async (input: {
  externalId: string;
  amount: string;
  currency: string;
  backUrl: string;
  email: string;
  fullName: string;
  metadata: Record<string, string>;
}) => {
  // backUrl is used as both success and cancel URL for backward compat
  const successUrl = input.backUrl;
  const cancelUrl = input.backUrl.replace(/\/order\//, "/review?id=") || input.backUrl;
  // Actually use backUrl as successUrl and construct cancelUrl from metadata
  const result = await createStripeCheckoutSession({
    externalId: input.externalId,
    amount: input.amount,
    currency: input.currency,
    successUrl,
    cancelUrl: cancelUrl.startsWith("https://") ? cancelUrl : successUrl,
    email: input.email,
    fullName: input.fullName,
    metadata: input.metadata,
  });
  return {
    orderUUID: result.sessionId,
    externalId: result.externalId,
    status: result.status as "UNPAID" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED",
    amount: result.amount,
    currency: result.currency,
    checkoutUrl: result.checkoutUrl,
    transactionRef: null,
  };
};

export const getPayMeGateOrder = async (orderUUID: string) => {
  const session = await getStripeSession(orderUUID);
  return {
    orderUUID: session.sessionId,
    externalId: session.metadata?.externalId || "",
    status: session.status as "UNPAID" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED",
    amount: session.amount,
    currency: session.currency,
    checkoutUrl: session.checkoutUrl,
    transactionRef: session.paymentIntentId,
    paidTransactionUUID: session.paymentIntentId || undefined,
  };
};

export class PaymentConfigurationError extends Error {
  status = 503;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
