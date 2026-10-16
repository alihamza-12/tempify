import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { connectToDatabase } from "@/lib/db";
import { calculateQuotePrice, getDurationOptions, getPricingCategory } from "@/modules/quotes/pricing";

export const runtime = "nodejs";

/*
 * GET /api/pricing
 * Returns duration options and pricing config (public, no auth)
 * Used by QuoteForm to show dynamic options and preview prices
 */
export async function GET() {
  try {
    await connectToDatabase();
    const durationOptions = await getDurationOptions();
    return NextResponse.json({
      success: true,
      durationOptions,
      currency: "GBP",
    });
  } catch (error) {
    return apiError(error, "Unable to load pricing options");
  }
}

/*
 * POST /api/pricing
 * Body: { durationUnit: "hours"|"days"|"weeks", durationValue: number, startAt: ISO string }
 * Returns calculated price from DB (past/present/future logic)
 * This is used for live preview when customer fills form fully
 */
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { durationUnit, durationValue, startAt } = body;

    if (!durationUnit || !["hours", "days", "weeks"].includes(durationUnit)) {
      return NextResponse.json({ error: "Invalid durationUnit" }, { status: 400 });
    }
    const value = Math.max(1, Math.floor(Number(durationValue)));
    if (!Number.isFinite(value) || value < 1 || value > 365) {
      return NextResponse.json({ error: "Invalid durationValue" }, { status: 400 });
    }

    let startDate: Date | undefined;
    if (startAt) {
      startDate = new Date(startAt);
      if (Number.isNaN(startDate.getTime())) {
        return NextResponse.json({ error: "Invalid startAt" }, { status: 400 });
      }
    }

    const pricing = await calculateQuotePrice(durationUnit, value, startDate);
    const category = getPricingCategory(startDate);

    return NextResponse.json({
      success: true,
      pricing,
      category,
      durationUnit,
      durationValue: value,
      startAt: startDate?.toISOString() || null,
    });
  } catch (error) {
    return apiError(error, "Unable to calculate pricing");
  }
}
