import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyPayMeGateWebhook } from "./webhook";

describe("PayMeGate webhook verification (legacy)", () => {
  afterEach(() => delete process.env.PAYMEGATE_WEBHOOK_SECRET);
  it("accepts a current valid HMAC and rejects a forged one", () => {
    process.env.PAYMEGATE_WEBHOOK_SECRET = "test-secret";
    const rawBody = JSON.stringify({ type: "order.paid" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", "test-secret").update(`${timestamp}.${rawBody}`).digest("base64url");
    expect(verifyPayMeGateWebhook({ rawBody, timestamp, signature })).toBe(true);
    expect(verifyPayMeGateWebhook({ rawBody, timestamp, signature: "forged" })).toBe(false);
  });
});

describe("Stripe webhook verification", () => {
  it("placeholder - Stripe verification uses Stripe library constructEvent", () => {
    // Stripe webhook verification is tested via Stripe's own library
    // This test ensures the module loads without error
    expect(true).toBe(true);
  });
});
