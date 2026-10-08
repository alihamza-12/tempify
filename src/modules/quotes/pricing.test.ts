import { describe, expect, it } from "vitest";
import { calculateQuotePrice, getEndDate } from "./pricing";

describe("quote pricing", () => {
  it("uses the configured one-hour base price", () => {
    expect(calculateQuotePrice("hours", 1).amount).toBe(15.13);
  });
  it("increases with duration", () => {
    expect(calculateQuotePrice("days", 3).amount).toBeGreaterThan(calculateQuotePrice("days", 1).amount);
  });
  it("charges more for a past start and keeps current or future pricing normal", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const past = calculateQuotePrice("hours", 1, new Date("2026-10-06T12:00:00.000Z"), now);
    const current = calculateQuotePrice("hours", 1, new Date("2026-10-07T12:00:00.000Z"), now);
    const future = calculateQuotePrice("hours", 1, new Date("2026-10-08T12:00:00.000Z"), now);

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
});
