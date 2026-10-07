import { Schema, model, models } from "mongoose";

const orderSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    quoteId: { type: Schema.Types.ObjectId, ref: "Quote", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerEmail: { type: String, required: true, lowercase: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "GBP" },
    status: {
      type: String,
      enum: ["unpaid", "paid", "failed", "cancelled", "expired"],
      default: "unpaid",
      index: true,
    },
    paymegateOrderUUID: String,
    checkoutUrl: String,
    transactionUUID: String,
    transactionRef: String,
    paidAt: Date,
    processedEventIds: { type: [String], default: [] },
    confirmationEmailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    confirmationEmailId: String,
    confirmationEmailError: String,
  },
  { timestamps: true, collection: "tempify_orders" },
);

orderSchema.index({ paymegateOrderUUID: 1 }, { sparse: true });

export const Order = models.Order || model("Order", orderSchema);
