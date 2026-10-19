import { sampleDocumentInputFromQuote } from "@/modules/policy-documents/from-quote";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { apiError } from "@/lib/http";
import { getSession } from "@/lib/session";
import { Order } from "@/models/Order";
import { Quote } from "@/models/Quote";
import { User } from "@/models/User";
import { createStripeCheckoutSession } from "@/modules/payments/stripe";
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
      Quote.findOne({ publicId: input.quoteId, status: { $in: ["draft", "checkout"] }, expiresAt: { $gt: new Date() } }),
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

    // Preserve the existing live-checkout gate.
    if (process.env.LIVE_POLICY_CHECKOUT_ENABLED !== "true") {
      return NextResponse.json(
        { error: "Your details were saved, but checkout is not enabled until policy-issuance authority is confirmed." },
        { status: 503 },
      );
    }

    const existing = await Order.findOne({ quoteId: quote._id, userId: user._id });
    if (existing?.status === "unpaid" && existing.checkoutUrl && existing.checkoutCreationStatus !== "review_required") {
      return NextResponse.json({ orderId: existing.publicId, checkoutUrl: existing.checkoutUrl });
    }
    if (existing || quote.status !== "draft") {
      return NextResponse.json({ error: "Checkout is already being prepared or needs review. Do not create another payment for this quote.", code: "CHECKOUT_IN_PROGRESS" }, { status: 409 });
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl || !appUrl.startsWith("https://")) {
      return NextResponse.json({ error: "Online payment is temporarily unavailable." }, { status: 503 });
    }

    const publicId = randomUUID();
    // Validate the snapshot before locking the quote or calling the provider.
    const documentSnapshot = sampleDocumentInputFromQuote(quote, {
      publicId,
      customerEmail: user.email,
      amount: quote.pricing.amount,
      currency: quote.pricing.currency,
    });
    const claimedQuote = await Quote.findOneAndUpdate(
      { _id: quote._id, status: "draft", expiresAt: { $gt: new Date() } },
      { $set: { status: "checkout", userId: user._id } },
      { returnDocument: "after" },
    );
    if (!claimedQuote) {
      return NextResponse.json({ error: "Checkout is already being prepared. Please wait; do not pay twice.", code: "CHECKOUT_IN_PROGRESS" }, { status: 409 });
    }
    const order = await Order.create({
      publicId,
      quoteId: quote._id,
      userId: user._id,
      customerEmail: user.email,
      amount: quote.pricing.amount,
      currency: quote.pricing.currency,
      documentSnapshot,
      status: "unpaid",
    });

    try {
      const remote = await createStripeCheckoutSession({
        externalId: publicId,
        amount: Number(quote.pricing.amount).toFixed(2),
        currency: quote.pricing.currency,
        successUrl: `${appUrl.replace(/\/$/, "")}/order/${publicId}`,
        cancelUrl: `${appUrl.replace(/\/$/, "")}/review?id=${quote.publicId}`,
        email: quote.driver.email,
        fullName: `${quote.driver.firstName} ${quote.driver.lastName}`.trim(),
        metadata: { quoteId: quote.publicId, registration: quote.vehicle.registration },
      });
      order.stripeSessionId = remote.sessionId;
      order.paymegateOrderUUID = remote.sessionId; // Keep for backward compat with old validation
      order.checkoutUrl = remote.checkoutUrl;
      order.checkoutCreationStatus = "ready";
      await order.save();
      return NextResponse.json({ orderId: publicId, checkoutUrl: remote.checkoutUrl }, { status: 201 });
    } catch (error) {
      // A timeout may occur AFTER the provider created an order. Preserve its
      // correlation ID for review; never blindly delete and create a second charge.
      await Order.updateOne({ _id: order._id, status: "unpaid" }, { $set: { checkoutCreationStatus: "review_required" } });
      console.warn("[payment:create] checkout requires review", publicId, error instanceof Error ? error.name : "UnknownError");
      return NextResponse.json({ error: "We could not confirm checkout creation. Do not pay again; contact support with this order reference.", orderId: publicId, code: "CHECKOUT_REVIEW_REQUIRED" }, { status: 502 });
    }
  } catch (error) {
    return apiError(error, "Unable to create a secure checkout.");
  }
}
