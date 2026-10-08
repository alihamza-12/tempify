export type DurationUnit = "hours" | "days" | "weeks";

const PRICE_VERSION = "v2-past-start";
const PAST_START_GRACE_MS = 5 * 60 * 1000;
const PAST_START_SURCHARGE_RATE = 0.35;

export function calculateQuotePrice(
  unit: DurationUnit,
  value: number,
  startAt?: Date,
  referenceNow = new Date(),
) {
  const safeValue = Math.max(1, Math.floor(value));
  let baseAmount: number;

  if (unit === "hours") baseAmount = 15.13 + Math.max(0, safeValue - 1) * 4.85;
  else if (unit === "days") baseAmount = 29.95 + Math.max(0, safeValue - 1) * 18.5;
  else baseAmount = 109.95 + Math.max(0, safeValue - 1) * 79;

  baseAmount = Number(baseAmount.toFixed(2));
  const pastStartSurchargeApplied = Boolean(
    startAt
      && Number.isFinite(startAt.getTime())
      && startAt.getTime() < referenceNow.getTime() - PAST_START_GRACE_MS,
  );
  const surchargeAmount = pastStartSurchargeApplied
    ? Number((baseAmount * PAST_START_SURCHARGE_RATE).toFixed(2))
    : 0;

  return {
    amount: Number((baseAmount + surchargeAmount).toFixed(2)),
    baseAmount,
    surchargeAmount,
    pastStartSurchargeApplied,
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
