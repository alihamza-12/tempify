import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Order } from "@/models/Order";
import { getPayMeGateOrder, mapPaymentStatus } from "@/modules/payments/paymegate";
import { markOrderPaid } from "@/modules/payments/fulfillment";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  await connectToDatabase();
  const { id } = await context.params;
  const order = await Order.findOne({ publicId: id, userId: session.userId }).lean();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  let status = order.status;
  if (status === "unpaid" && order.paymegateOrderUUID && process.env.PAYMEGATE_API_KEY) {
    try {
      const remote = await getPayMeGateOrder(order.paymegateOrderUUID);
      status = mapPaymentStatus(remote.status) as typeof status;
      if (status === "paid") {
        await markOrderPaid({
          externalId: order.publicId,
          eventId: `reconcile:${remote.orderUUID}`,
          orderUUID: remote.orderUUID,
          transactionUUID: remote.paidTransactionUUID,
          transactionRef: remote.transactionRef,
          paidAt: remote.paidAt,
          amount: remote.amount,
          currency: remote.currency,
        });
      } else if (status !== order.status) {
        await Order.updateOne({ _id: order._id }, { $set: { status } });
      }
    } catch (error) {
      console.warn("[payment:status] remote reconciliation unavailable", error);
    }
  }

  return NextResponse.json({
    orderId: order.publicId,
    status,
    amount: order.amount,
    currency: order.currency,
    paidAt: order.paidAt || null,
  });
}
