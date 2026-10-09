import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getSession } from "@/lib/session";
import { User } from "@/models/User";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { headers: noStoreHeaders });

  await connectToDatabase();
  const user = await User.findById(session.userId).select("fullName email role status").lean();
  if (!user || user.status === "Suspended") {
    return NextResponse.json({ user: null }, { status: 401, headers: noStoreHeaders });
  }

  return NextResponse.json(
    { user: { id: String(user._id), email: user.email, fullName: user.fullName, role: user.role } },
    { headers: noStoreHeaders },
  );
}
