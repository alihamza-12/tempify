import { describe, expect, it } from "vitest";
import { generatePaymentReceipt } from "./paymentReceipt";

describe("payment receipt", () => {
  it("generates a PDF receipt that is not an insurance certificate", async () => {
    const pdf = await generatePaymentReceipt({
      orderId: "order-test-1",
      transactionReference: "transaction-test-1",
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      registration: "SJ18OBW",
      vehicle: "Ford Focus",
      startAt: new Date("2026-10-10T08:00:00.000Z"),
      endAt: new Date("2026-10-10T09:00:00.000Z"),
      amount: 25,
      currency: "GBP",
      paidAt: new Date("2026-10-10T07:59:00.000Z"),
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
