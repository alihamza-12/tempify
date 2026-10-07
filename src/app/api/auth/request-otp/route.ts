import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requestOtpSchema } from "@/modules/auth/schemas";
import { beginRegistration } from "@/modules/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = requestOtpSchema.parse(await request.json());
    const development = await beginRegistration(input);
    return NextResponse.json({
      success: true,
      message: "We sent a six-digit verification code to your email.",
      ...development,
    });
  } catch (error) {
    return apiError(error, "We could not send the verification email.");
  }
}
