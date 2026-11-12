import { describe, expect, it } from "vitest";
import { canUseStripeTestCheckout, isAllowedTestCheckoutEmail } from "./checkout-mode";

describe("environment-safe Stripe test checkout", () => {
  it("allows only Stripe test secrets, never a live secret", () => {
    expect(canUseStripeTestCheckout({ secretKey: "sk_test_local", nodeEnv: "development" })).toBe(true);
    expect(canUseStripeTestCheckout({ secretKey: "sk_live_production", nodeEnv: "development" })).toBe(false);
    expect(canUseStripeTestCheckout({ secretKey: "sk_live_production", nodeEnv: "production", enabledInProduction: "true" })).toBe(false);
  });

  it("requires an explicit switch for test checkout in deployed production builds", () => {
    expect(canUseStripeTestCheckout({ secretKey: "sk_test_preview", nodeEnv: "production" })).toBe(false);
    expect(canUseStripeTestCheckout({ secretKey: "sk_test_preview", nodeEnv: "production", enabledInProduction: "true" })).toBe(true);
    expect(canUseStripeTestCheckout({ secretKey: "sk_test_preview", nodeEnv: "production", enabledInProduction: "TRUE" })).toBe(false);
  });

  it("requires a matching allowlisted test email", () => {
    expect(isAllowedTestCheckoutEmail("Tester@example.com", " tester@example.com , other@example.com ")).toBe(true);
    expect(isAllowedTestCheckoutEmail("otherperson@example.com", "tester@example.com")).toBe(false);
    expect(isAllowedTestCheckoutEmail("tester@example.com", "")).toBe(false);
  });
});
