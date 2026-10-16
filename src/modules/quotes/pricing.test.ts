import { describe, expect, it } from "vitest";
import { calculateQuotePrice, calculateQuotePriceSync, getEndDate, getPricingCategory } from "./pricing";

describe("quote pricing", () => {
  it("uses the configured one-hour base price (sync fallback)", () => {
    expect(calculateQuotePriceSync("hours", 1).amount).toBe(15.13);
  });
  it("increases with duration (sync)", () => {
    expect(calculateQuotePriceSync("days", 3).amount).toBeGreaterThan(calculateQuotePriceSync("days", 1).amount);
  });
  it("charges more for a past start and keeps current or future pricing normal (sync)", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const past = calculateQuotePriceSync("hours", 1, new Date("2026-10-06T12:00:00.000Z"), now);
    const current = calculateQuotePriceSync("hours", 1, new Date("2026-10-07T12:00:00.000Z"), now);
    const future = calculateQuotePriceSync("hours", 1, new Date("2026-10-08T12:00:00.000Z"), now);

    expect(past.amount).toBeGreaterThan(current.amount);
    expect(past.pastStartSurchargeApplied).toBe(true);
    expect(past.surchargeAmount).toBeGreaterThan(0);
    expect(current.amount).toBe(15.13);
    expect(future.amount).toBe(15.13);
  });
  it("calculates an end time", () => {
    const start = new Date("2026-10-05T10:00:00.000Z");
    expect(getEndDate(start, "hours", 3).toISOString()).toBe("2026-10-05T13:00:00.000Z");
  });
  it("detects pricing category correctly", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    expect(getPricingCategory(new Date("2026-10-06T12:00:00.000Z"), now)).toBe("past");
    expect(getPricingCategory(new Date("2026-10-07T12:00:00.000Z"), now)).toBe("present");
    expect(getPricingCategory(new Date("2026-10-08T12:00:00.000Z"), now)).toBe("future");
  });
  it("async pricing falls back to hardcoded when DB unavailable", async () => {
    const result = await calculateQuotePrice("hours", 1);
    expect(result.amount).toBeGreaterThan(0);
    expect(result.fromDatabase).toBe(false); // no DB in test env
  });
});
