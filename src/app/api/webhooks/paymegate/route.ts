import { NextResponse } from "next/server";

/**
 * @deprecated PayMeGate webhook is deprecated - replaced by Stripe
 * This endpoint is kept for backward compatibility but returns 410 Gone
 * New webhook: /api/webhooks/stripe
 */
export const runtime = "nodejs";

export async function POST() {
  console.warn("[paymegate:webhook] deprecated endpoint called - PayMeGate replaced by Stripe");
  return NextResponse.json(
    {
      received: false,
      error: "PayMeGate is deprecated. Use Stripe webhook at /api/webhooks/stripe",
      deprecated: true,
      newEndpoint: "/api/webhooks/stripe",
    },
    { status: 410 },
  );
}

export async function GET() {
  return NextResponse.json({
    status: "deprecated",
    message: "PayMeGate webhook is deprecated. Use /api/webhooks/stripe",
    newEndpoint: "/api/webhooks/stripe",
    deprecated: true,
  });
}
