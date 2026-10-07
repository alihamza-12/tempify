import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { createQuoteSchema } from "@/modules/quotes/schema";
import { createQuote } from "@/modules/quotes/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = createQuoteSchema.parse(await request.json());
    const result = await createQuote(input);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return apiError(error, "We could not create your quote.");
  }
}
