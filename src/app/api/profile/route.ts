import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import {
  createSessionToken,
  getSession,
  setSessionCookie,
} from "@/lib/session";
import { User } from "@/models/User";
import { customerProfileSchema } from "@/modules/profile/schema";
import {
  saveCustomerProfile,
  serializeCustomerProfile,
} from "@/modules/profile/service";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ profile: null }, { status: 401, headers: noStoreHeaders });
    }

    await connectToDatabase();
    const user = await User.findById(session.userId).lean();
    if (!user || user.status !== "Active" || user.role !== "Customer") {
      return NextResponse.json({ profile: null }, { status: 403, headers: noStoreHeaders });
    }

    return NextResponse.json(
      { profile: serializeCustomerProfile(user as Record<string, unknown>) },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return apiError(error, "Unable to load your profile.");
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (session.role !== "Customer") {
      return NextResponse.json({ error: "Only customer profiles can be edited here." }, { status: 403 });
    }

    const input = customerProfileSchema.parse(await request.json());
    const profile = await saveCustomerProfile(session.userId, input);

    if (profile.email !== session.email) {
      const token = await createSessionToken({
        userId: session.userId,
        email: profile.email,
        role: session.role,
      });
      await setSessionCookie(token);
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return apiError(error, "Unable to save your profile.");
  }
}
