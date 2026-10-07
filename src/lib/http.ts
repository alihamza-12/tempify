import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message || "Invalid request." },
      { status: 400 },
    );
  }

  if (error && typeof error === "object" && "status" in error && "message" in error) {
    return NextResponse.json(
      { error: String(error.message) },
      { status: Number(error.status) || 400 },
    );
  }

  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
