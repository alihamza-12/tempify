import { describe, expect, it } from "vitest";
import { gbpPence, matchesStoredPayment, paidPaymentSchema } from "./validation";

const order = { publicId: "local-order", stripeSessionId: "provider-order", paymegateOrderUUID: "provider-order", amount: 12.34, currency: "GBP" };
const payment = { transactionUUID: "30569045-9e69-41cb-9083-8ac5e3d76a5e", externalId: "local-order", orderUUID: "provider-order", amount: "12.34", currency: "GBP" };

describe("payment identity and exact GBP amount", () => {
  it.each(["12.34", "12.3400", "012.34"])("accepts an exact amount: %s", (amount) => {
    expect(matchesStoredPayment(order, { ...payment, amount })).toBe(true);
  });
  it.each(["12.344", "12.335", "12.33", "0", "-12.34", "NaN", "Infinity", "1.234e1", "", " 12.34", "999999999999999999"])("rejects invalid or mismatched amounts: %s", (amount) => {
    expect(matchesStoredPayment(order, { ...payment, amount })).toBe(false);
  });
  it("does not replace a stored provider identity", () => {
    expect(matchesStoredPayment(order, { ...payment, orderUUID: "other" })).toBe(false);
    expect(matchesStoredPayment({ ...order, stripeSessionId: null, paymegateOrderUUID: null }, payment)).toBe(false);
    expect(matchesStoredPayment(order, { ...payment, externalId: "another-customer" })).toBe(false);
  });
  it("rejects other currencies and invalid stored amounts", () => {
    expect(matchesStoredPayment(order, { ...payment, currency: "USD" })).toBe(false);
    expect(matchesStoredPayment({ ...order, amount: NaN }, payment)).toBe(false);
    expect(matchesStoredPayment({ ...order, currency: "USD" }, { ...payment, currency: "USD" })).toBe(false);
  });
  it("handles whole pounds, pence, and trailing zero precision", () => {
    expect(gbpPence("12")).toBe(1200);
    expect(gbpPence("12.3")).toBe(1230);
    expect(gbpPence("0.01")).toBe(1);
    expect(gbpPence("12.340000")).toBe(1234);
  });
  it("requires event identity and a valid optional timestamp", () => {
    expect(paidPaymentSchema.safeParse({ ...payment, eventId: "event-1" }).success).toBe(true);
    expect(paidPaymentSchema.safeParse(payment).success).toBe(false);
    expect(paidPaymentSchema.safeParse({ ...payment, eventId: "" }).success).toBe(false);
    expect(paidPaymentSchema.safeParse({ ...payment, eventId: "event-1", paidAt: "invalid" }).success).toBe(false);
    expect(paidPaymentSchema.safeParse({ ...payment, eventId: "event-1", paidAt: "2026-10-14T12:00:00Z" }).success).toBe(true);
  });
  it("supports Stripe session ID", () => {
    const stripeOrder = { publicId: "local-order", stripeSessionId: "cs_test_123", amount: 12.34, currency: "GBP" };
    const stripePayment = { ...payment, orderUUID: "cs_test_123" };
    expect(matchesStoredPayment(stripeOrder, stripePayment)).toBe(true);
  });
});
