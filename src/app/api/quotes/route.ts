import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createQuoteSchema } from "@/modules/quotes/schema";
import { createQuote } from "@/modules/quotes/service";
import { createSessionToken, getSession, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = createQuoteSchema.parse(await request.json());
    const session = await getSession();
    const result = await createQuote(input, session?.userId);
    if (session && session.email !== input.driver.email) {
      const token = await createSessionToken({
        userId: session.userId,
        email: input.driver.email,
        role: session.role,
      });
      await setSessionCookie(token);
    }
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return apiError(error, "We could not create your quote.");
  }
}
