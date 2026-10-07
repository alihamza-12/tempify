import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { verifyOtpSchema } from "@/modules/auth/schemas";
import { completeRegistration } from "@/modules/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = verifyOtpSchema.parse(await request.json());
    const user = await completeRegistration(input.email, input.code);
    const token = await createSessionToken({ userId: user.id, email: user.email, role: user.role });
    await setSessionCookie(token);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return apiError(error, "We could not verify this code.");
  }
}
