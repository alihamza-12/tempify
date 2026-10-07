import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { getSession } from "@/lib/session";
import { Order } from "@/models/Order";
import { Quote } from "@/models/Quote";
import { User } from "@/models/User";
import { createPayMeGateOrder } from "@/modules/payments/paymegate";

export const runtime = "nodejs";
const inputSchema = z.object({ quoteId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in before checkout.", code: "AUTH_REQUIRED" }, { status: 401 });
    const input = inputSchema.parse(await request.json());
    await connectToDatabase();

    const [quote, user] = await Promise.all([
      Quote.findOne({ publicId: input.quoteId, status: "draft", expiresAt: { $gt: new Date() } }),
      User.findById(session.userId).select("fullName email status"),
    ]);
    if (!quote) return NextResponse.json({ error: "This quote is unavailable or has expired." }, { status: 404 });
    if (!user || user.status !== "Active") return NextResponse.json({ error: "Your account is unavailable." }, { status: 403 });

    const existing = await Order.findOne({ quoteId: quote._id, userId: user._id, status: "unpaid" });
    if (existing?.checkoutUrl) {
      return NextResponse.json({ orderId: existing.publicId, checkoutUrl: existing.checkoutUrl });
    }

    const publicId = randomUUID();
    const order = await Order.create({
      publicId,
      quoteId: quote._id,
      userId: user._id,
      customerEmail: user.email,
      amount: quote.pricing.amount,
      currency: quote.pricing.currency,
      status: "unpaid",
    });

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl || !appUrl.startsWith("https://")) {
        throw Object.assign(new Error("Set NEXT_PUBLIC_APP_URL to the public HTTPS website URL before enabling payment."), { status: 503 });
      }
      const remote = await createPayMeGateOrder({
        externalId: publicId,
        amount: Number(quote.pricing.amount).toFixed(2),
        currency: quote.pricing.currency,
        backUrl: `${appUrl.replace(/\/$/, "")}/order/${publicId}`,
        email: user.email,
        fullName: user.fullName,
        metadata: { quoteId: quote.publicId, registration: quote.vehicle.registration },
      });
      order.paymegateOrderUUID = remote.orderUUID;
      order.checkoutUrl = remote.checkoutUrl;
      quote.status = "checkout";
      quote.userId = user._id;
      await Promise.all([order.save(), quote.save()]);
      return NextResponse.json({ orderId: publicId, checkoutUrl: remote.checkoutUrl }, { status: 201 });
    } catch (error) {
      await Order.deleteOne({ _id: order._id, status: "unpaid" });
      throw error;
    }
  } catch (error) {
    return apiError(error, "Unable to create a secure checkout.");
  }
}
