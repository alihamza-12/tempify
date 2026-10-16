import { CuvvafyPricing } from "@/models/CuvvafyPricing";

export type DurationUnit = "hours" | "days" | "weeks";
export type PricingCategory = "past" | "present" | "future";

const PRICE_VERSION = "v3-dynamic-cuvvafy";
const DEFAULT_GRACE_MS = 5 * 60 * 1000;

export type PricingResult = {
  amount: number;
  baseAmount: number;
  surchargeAmount: number;
  pastStartSurchargeApplied: boolean;
  currency: string;
  calculationVersion: string;
  category: PricingCategory;
  durationUnit: DurationUnit;
  durationValue: number;
  pricingMode: string;
  fromDatabase: boolean;
};

// Fallback hardcoded pricing (original v2)
function calculateFallbackPrice(unit: DurationUnit, value: number, startAt?: Date, referenceNow = new Date(), graceMs = DEFAULT_GRACE_MS) {
  const safeValue = Math.max(1, Math.floor(value));
  let baseAmount: number;

  if (unit === "hours") baseAmount = 15.13 + Math.max(0, safeValue - 1) * 4.85;
  else if (unit === "days") baseAmount = 29.95 + Math.max(0, safeValue - 1) * 18.5;
  else baseAmount = 109.95 + Math.max(0, safeValue - 1) * 79;

  baseAmount = Number(baseAmount.toFixed(2));
  const pastStartSurchargeApplied = Boolean(
    startAt && Number.isFinite(startAt.getTime()) && startAt.getTime() < referenceNow.getTime() - graceMs
  );
  const surchargeAmount = pastStartSurchargeApplied ? Number((baseAmount * 0.35).toFixed(2)) : 0;

  return {
    amount: Number((baseAmount + surchargeAmount).toFixed(2)),
    baseAmount,
    surchargeAmount,
    pastStartSurchargeApplied,
    currency: process.env.PAYMENT_CURRENCY || "GBP",
    calculationVersion: "v2-past-start-fallback",
  };
}

export function getPricingCategory(startAt?: Date, referenceNow = new Date(), graceMs = DEFAULT_GRACE_MS): PricingCategory {
  if (!startAt || !Number.isFinite(startAt.getTime())) return "present";
  const time = startAt.getTime();
  const now = referenceNow.getTime();
  if (time < now - graceMs) return "past";
  if (time > now + graceMs) return "future";
  return "present";
}

function toPlainMap(map: any): Record<string, number> {
  if (!map) return {};
  if (map instanceof Map) {
    const obj: Record<string, number> = {};
    for (const [k, v] of map.entries()) obj[String(k)] = Number(v);
    return obj;
  }
  // If it's a plain object
  if (typeof map === "object") {
    const obj: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
      // Skip mongoose internal
      if (k.startsWith("$") || k.startsWith("_")) continue;
      obj[k] = Number(v);
    }
    return obj;
  }
  return {};
}

export async function getPricingConfig() {
  try {
    // Avoid hanging when mongoose not connected (tests without DB)
    const mongoose = await import("mongoose");
    if (mongoose.default.connection.readyState !== 1) {
      return null;
    }
    const config = await (CuvvafyPricing as any).findOne({ configId: "global", isActive: true }).lean().maxTimeMS(2000).exec();
    if (!config) return null;
    return config;
  } catch {
    return null;
  }
}

export async function calculateQuotePrice(
  unit: DurationUnit,
  value: number,
  startAt?: Date,
  referenceNow = new Date()
): Promise<PricingResult> {
  const safeValue = Math.max(1, Math.floor(value));
  const safeUnit = (["hours", "days", "weeks"].includes(unit) ? unit : "hours") as DurationUnit;

  // Try to get dynamic pricing from DB
  let dbConfig: any = null;
  try {
    dbConfig = await getPricingConfig();
  } catch {
    dbConfig = null;
  }

  const graceMinutes = dbConfig?.graceMinutes ?? 5;
  const graceMs = graceMinutes * 60 * 1000;
  const category = getPricingCategory(startAt, referenceNow, graceMs);
  const currency = dbConfig?.currency || process.env.PAYMENT_CURRENCY || "GBP";

  if (dbConfig && dbConfig.isActive) {
    const categoryMode = dbConfig.categoryModes?.[category] || dbConfig.pricingMode || "both";
    const flatMap = toPlainMap(dbConfig.pricing?.[category]?.[safeUnit]);
    const formula = dbConfig.formula?.[category]?.[safeUnit];

    // Try flat pricing first if mode allows
    if ((categoryMode === "flat" || categoryMode === "both") && flatMap[String(safeValue)] !== undefined) {
      const flatPrice = Number(flatMap[String(safeValue)]);
      if (Number.isFinite(flatPrice) && flatPrice >= 0) {
        return {
          amount: Number(flatPrice.toFixed(2)),
          baseAmount: Number(flatPrice.toFixed(2)),
          surchargeAmount: 0,
          pastStartSurchargeApplied: category === "past",
          currency,
          calculationVersion: `${PRICE_VERSION}-${category}-flat-db`,
          category,
          durationUnit: safeUnit,
          durationValue: safeValue,
          pricingMode: categoryMode,
          fromDatabase: true,
        };
      }
    }

    // Try formula pricing if mode allows
    if ((categoryMode === "formula" || categoryMode === "both") && formula) {
      const base = Number(formula.base ?? 0);
      const perExtra = Number(formula.perExtra ?? 0);
      if (Number.isFinite(base) && Number.isFinite(perExtra)) {
        const calculated = base + Math.max(0, safeValue - 1) * perExtra;
        const amount = Number(calculated.toFixed(2));
        return {
          amount,
          baseAmount: Number(base.toFixed(2)),
          surchargeAmount: Number((amount - base).toFixed(2)),
          pastStartSurchargeApplied: category === "past",
          currency,
          calculationVersion: `${PRICE_VERSION}-${category}-formula-db`,
          category,
          durationUnit: safeUnit,
          durationValue: safeValue,
          pricingMode: categoryMode,
          fromDatabase: true,
        };
      }
    }

    // If both mode and flat not found, fallback to formula if available
    if (categoryMode === "both" && formula) {
      const base = Number(formula.base ?? 0);
      const perExtra = Number(formula.perExtra ?? 0);
      const calculated = base + Math.max(0, safeValue - 1) * perExtra;
      const amount = Number(calculated.toFixed(2));
      return {
        amount,
        baseAmount: Number(base.toFixed(2)),
        surchargeAmount: Number((amount - base).toFixed(2)),
        pastStartSurchargeApplied: category === "past",
        currency,
        calculationVersion: `${PRICE_VERSION}-${category}-formula-fallback-db`,
        category,
        durationUnit: safeUnit,
        durationValue: safeValue,
        pricingMode: categoryMode,
        fromDatabase: true,
      };
    }
  }

  // Fallback to hardcoded pricing
  const fallback = calculateFallbackPrice(safeUnit, safeValue, startAt, referenceNow, graceMs);
  return {
    ...fallback,
    category: getPricingCategory(startAt, referenceNow, graceMs),
    durationUnit: safeUnit,
    durationValue: safeValue,
    pricingMode: "fallback",
    fromDatabase: false,
    calculationVersion: `${PRICE_VERSION}-${getPricingCategory(startAt, referenceNow, graceMs)}-fallback`,
  };
}

// Sync version for tests or where DB not available — uses fallback logic
export function calculateQuotePriceSync(
  unit: DurationUnit,
  value: number,
  startAt?: Date,
  referenceNow = new Date()
) {
  const safeValue = Math.max(1, Math.floor(value));
  const category = getPricingCategory(startAt, referenceNow, DEFAULT_GRACE_MS);
  const fallback = calculateFallbackPrice(unit, safeValue, startAt, referenceNow, DEFAULT_GRACE_MS);
  return {
    ...fallback,
    category,
    durationUnit: unit,
    durationValue: safeValue,
    pricingMode: "sync-fallback",
    fromDatabase: false,
  };
}

export function getEndDate(startAt: Date, unit: DurationUnit, value: number) {
  const result = new Date(startAt);
  if (unit === "hours") result.setHours(result.getHours() + value);
  if (unit === "days") result.setDate(result.getDate() + value);
  if (unit === "weeks") result.setDate(result.getDate() + value * 7);
  return result;
}

export async function getDurationOptions() {
  try {
    const config = await getPricingConfig();
    if (config?.durationOptions) {
      return {
        hours: config.durationOptions.hours || [1, 3, 5, 12, 24],
        days: config.durationOptions.days || [1, 2, 3, 4, 5, 6, 7],
        weeks: config.durationOptions.weeks || [1, 2, 3, 4],
      };
    }
  } catch {}
  return {
    hours: [1, 3, 5, 12, 24],
    days: [1, 2, 3, 5, 7],
    weeks: [1, 2, 3, 4],
  };
}
