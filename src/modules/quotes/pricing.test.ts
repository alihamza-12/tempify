import { describe, expect, it } from "vitest";
import { calculateQuotePrice, getEndDate } from "./pricing";

describe("quote pricing", () => {
  it("uses the configured one-hour base price", () => {
    expect(calculateQuotePrice("hours", 1).amount).toBe(15.13);
  });
  it("increases with duration", () => {
    expect(calculateQuotePrice("days", 3).amount).toBeGreaterThan(calculateQuotePrice("days", 1).amount);
  });
  it("calculates an end time", () => {
    const start = new Date("2026-10-05T10:00:00.000Z");
    expect(getEndDate(start, "hours", 3).toISOString()).toBe("2026-10-05T13:00:00.000Z");
  });
});
