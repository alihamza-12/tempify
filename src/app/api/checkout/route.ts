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
import { customerProfileSchema } from "@/modules/profile/schema";
import { saveCustomerProfile } from "@/modules/profile/service";

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
      User.findById(session.userId).select("fullName email status role"),
    ]);
    if (!quote) return NextResponse.json({ error: "This quote is unavailable or has expired." }, { status: 404 });
    if (!user || user.status !== "Active" || user.role !== "Customer") return NextResponse.json({ error: "Your customer account is unavailable." }, { status: 403 });
    if (user.email !== quote.driver.email) {
      return NextResponse.json(
        { error: `Sign in with ${quote.driver.email} to pay for this quote.` },
        { status: 409 },
      );
    }

    const requiredQuoteValues = [
      quote.driver.title,
      quote.driver.firstName,
      quote.driver.lastName,
      quote.driver.dateOfBirth,
      quote.driver.gender,
      quote.driver.occupation,
      quote.driver.phone,
      quote.driver.email,
      quote.address.line1,
      quote.address.city,
      quote.address.postcode,
      quote.licence.number,
      quote.licence.type,
      quote.licence.heldFor,
      quote.vehicle.registration,
      quote.vehicle.make,
      quote.vehicle.model,
      quote.vehicle.vehicleIdentificationNumber,
      quote.vehicleId,
    ];
    if (requiredQuoteValues.some((value) => !String(value || "").trim())) {
      return NextResponse.json(
        { error: "Complete all required customer, licence and verified vehicle details before payment." },
        { status: 400 },
      );
    }

    const profile = customerProfileSchema.parse({
      title: quote.driver.title,
      firstName: quote.driver.firstName,
      lastName: quote.driver.lastName,
      email: quote.driver.email,
      dateOfBirth: new Date(quote.driver.dateOfBirth).toISOString().slice(0, 10),
      gender: quote.driver.gender,
      occupation: quote.driver.occupation,
      phone: quote.driver.phone,
      drivingLicenceNumber: quote.licence.number,
      licenceType: quote.licence.type,
      licenceHeldFor: quote.licence.heldFor,
      lastFourDigits: quote.licence.lastFourDigits || "",
      address: {
        line1: quote.address.line1,
        line2: quote.address.line2 || "",
        city: quote.address.city,
        county: quote.address.county || "",
        postcode: quote.address.postcode,
        country: "GB",
      },
    });
    await saveCustomerProfile(String(user._id), profile);

    if (process.env.LIVE_POLICY_CHECKOUT_ENABLED !== "true") {
      return NextResponse.json(
        { error: "Your details were saved, but checkout is not enabled until policy-issuance authority is confirmed." },
        { status: 503 },
      );
    }

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
        console.error("[payment] NEXT_PUBLIC_APP_URL must be the public HTTPS website URL");
        throw Object.assign(
          new Error("Online payment is temporarily unavailable. Please try again later."),
          { status: 503 },
        );
      }
      const remote = await createPayMeGateOrder({
        externalId: publicId,
        amount: Number(quote.pricing.amount).toFixed(2),
        currency: quote.pricing.currency,
        backUrl: `${appUrl.replace(/\/$/, "")}/order/${publicId}`,
        email: quote.driver.email,
        fullName: `${quote.driver.firstName} ${quote.driver.lastName}`.trim(),
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
