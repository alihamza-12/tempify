import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { User } from "@/models/User";
import { loginSchema } from "@/modules/auth/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    await connectToDatabase();
    const user = await User.findOne({ email: input.email }).select("+password");

    const valid = user ? await bcrypt.compare(input.password, user.password) : false;
    if (!user || !valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    if (user.status === "Suspended") {
      return NextResponse.json({ error: "This account is currently unavailable." }, { status: 403 });
    }

    const token = await createSessionToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: { id: String(user._id), email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (error) {
    return apiError(error, "Unable to sign in.");
  }
}
