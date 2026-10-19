/**
 * @deprecated PayMeGate integration is deprecated - replaced by Stripe
 * This file is kept for backward compatibility and now re-exports Stripe implementation
 * New integration: src/modules/payments/stripe.ts
 * New webhook: /api/webhooks/stripe
 */

export {
  createStripeCheckoutSession as createPayMeGateOrder,
  getStripeSession as getPayMeGateOrder,
  mapPaymentStatus,
  PaymentConfigurationError,
  PaymentProviderError,
} from "./stripe";

// Legacy PayMeGate-specific functions (deprecated) - kept for backward compatibility
console.warn("[paymegate] deprecated - use Stripe integration at src/modules/payments/stripe.ts");
