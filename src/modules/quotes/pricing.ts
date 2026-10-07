export type DurationUnit = "hours" | "days" | "weeks";

const PRICE_VERSION = "v1";

export function calculateQuotePrice(unit: DurationUnit, value: number) {
  const safeValue = Math.max(1, Math.floor(value));
  let amount: number;

  if (unit === "hours") amount = 15.13 + Math.max(0, safeValue - 1) * 4.85;
  else if (unit === "days") amount = 29.95 + Math.max(0, safeValue - 1) * 18.5;
  else amount = 109.95 + Math.max(0, safeValue - 1) * 79;

  return {
    amount: Number(amount.toFixed(2)),
    currency: process.env.PAYMENT_CURRENCY || "GBP",
    calculationVersion: PRICE_VERSION,
  };
}

export function getEndDate(startAt: Date, unit: DurationUnit, value: number) {
  const result = new Date(startAt);
  if (unit === "hours") result.setHours(result.getHours() + value);
  if (unit === "days") result.setDate(result.getDate() + value);
  if (unit === "weeks") result.setDate(result.getDate() + value * 7);
  return result;
}
