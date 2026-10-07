import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models/Order";
import { Quote } from "@/models/Quote";
import { User } from "@/models/User";
import { sendPaymentConfirmationEmail } from "@/modules/email/service";

export async function markOrderPaid(input: {
  externalId: string;
  eventId: string;
  orderUUID: string;
  transactionUUID?: string;
  transactionRef?: string | null;
  paidAt?: string;
  amount: string;
  currency: string;
}) {
  await connectToDatabase();
  const order = await Order.findOne({ publicId: input.externalId });
  if (!order) return { found: false, changed: false };

  if (Number(input.amount).toFixed(2) !== Number(order.amount).toFixed(2) || input.currency !== order.currency) {
    console.error("[payment] amount or currency mismatch", input.externalId);
    return { found: true, changed: false };
  }

  const duplicate = order.processedEventIds.includes(input.eventId);
  if (!duplicate) order.processedEventIds.push(input.eventId);

  if (order.status !== "paid") {
    order.status = "paid";
    order.paymegateOrderUUID = input.orderUUID;
    order.transactionUUID = input.transactionUUID;
    order.transactionRef = input.transactionRef || undefined;
    order.paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    await order.save();

    const quote = await Quote.findByIdAndUpdate(order.quoteId, { status: "paid", userId: order.userId }, { new: true });
    if (quote) {
      await User.findByIdAndUpdate(order.userId, {
        $set: {
          phone: quote.driver.phone,
          dateOfBirth: quote.driver.dateOfBirth,
          drivingLicenceNumber: quote.licence.number,
          address: quote.address,
        },
      });
    }
  } else if (!duplicate) {
    await order.save();
  }

  await sendConfirmationOnce(String(order._id));
  return { found: true, changed: !duplicate };
}

async function sendConfirmationOnce(orderId: string) {
  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: "paid",
      confirmationEmailStatus: { $in: ["pending", "failed"] },
    },
    { $set: { confirmationEmailStatus: "sending", confirmationEmailError: null } },
    { new: true },
  );
  if (!claimed) return;

  try {
    const quote = await Quote.findById(claimed.quoteId).lean();
    if (!quote) throw new Error("Quote not found for confirmation email.");
    const result = await sendPaymentConfirmationEmail({
      email: claimed.customerEmail,
      name: quote.driver.firstName,
      orderId: claimed.publicId,
      registration: quote.vehicle.registration,
      vehicle: `${quote.vehicle.make} ${quote.vehicle.model}`,
      startAt: new Date(quote.cover.startAt),
      endAt: new Date(quote.cover.endAt),
      amount: claimed.amount,
      currency: claimed.currency,
    });
    await Order.updateOne(
      { _id: claimed._id },
      { $set: { confirmationEmailStatus: "sent", confirmationEmailId: result?.id || "sent" } },
    );
  } catch (error) {
    await Order.updateOne(
      { _id: claimed._id },
      {
        $set: {
          confirmationEmailStatus: "failed",
          confirmationEmailError: error instanceof Error ? error.message.slice(0, 300) : "Unknown email error",
        },
      },
    );
  }
}
