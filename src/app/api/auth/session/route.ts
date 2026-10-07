import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getSession } from "@/lib/session";
import { User } from "@/models/User";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  await connectToDatabase();
  const user = await User.findById(session.userId).select("fullName email role status").lean();
  if (!user || user.status === "Suspended") return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({
    user: { id: String(user._id), email: user.email, fullName: user.fullName, role: user.role },
  });
}
