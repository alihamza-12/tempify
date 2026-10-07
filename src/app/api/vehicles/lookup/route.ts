import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { findOrVerifyVehicle, VehicleLookupError } from "@/modules/vehicles/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = rateLimit(`vehicle:${ip}`, 15, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Please wait a moment.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const registration = new URL(request.url).searchParams.get("registration") || "";
  try {
    const result = await findOrVerifyVehicle(registration);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof VehicleLookupError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Vehicle lookup is temporarily unavailable.", code: "LOOKUP_FAILED" },
      { status: 500 },
    );
  }
}
