import { describe, expect, it } from "vitest";
import { mapStripeSessionStatus, stripeKeyConfigurationIsConsistent, stripeKeyModesMatch } from "./stripe";

describe("Stripe key and session validation", () => {
  it("rejects mismatched or malformed publishable keys", () => {
    expect(stripeKeyModesMatch("sk_test_example", "pk_test_example")).toBe(true);
    expect(stripeKeyModesMatch("sk_live_example", "pk_live_example")).toBe(true);
    expect(stripeKeyModesMatch("sk_test_example", "pk_live_example")).toBe(false);
    expect(stripeKeyModesMatch("sk_live_example", "pk_test_example")).toBe(false);
    expect(stripeKeyModesMatch("sk_test_example", "public-key-placeholder")).toBe(false);
    expect(stripeKeyConfigurationIsConsistent("sk_test_example", ["pk_test_example", "pk_test_example"])).toBe(true);
    expect(stripeKeyConfigurationIsConsistent("sk_test_example", ["pk_test_example", "pk_live_example"])).toBe(false);
  });
});

describe("Stripe Checkout settlement mapping", () => {
  it("accepts payment only when Stripe explicitly reports the session paid", () => {
    expect(mapStripeSessionStatus("paid", "complete")).toBe("PAID");
  });

  it("does not treat a completed but unpaid Checkout Session as a paid order", () => {
    expect(mapStripeSessionStatus("unpaid", "complete")).toBe("UNPAID");
  });

  it("keeps open sessions unpaid and reports expired sessions as expired", () => {
    expect(mapStripeSessionStatus("unpaid", "open")).toBe("UNPAID");
    expect(mapStripeSessionStatus("unpaid", "expired")).toBe("EXPIRED");
  });
});
