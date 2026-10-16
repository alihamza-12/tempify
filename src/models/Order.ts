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
    checkoutCreationStatus: { type: String, enum: ["creating", "ready", "review_required"], default: "creating" },
    transactionUUID: String,
    transactionRef: String,
    paidAt: Date,
    policyId: { type: Schema.Types.ObjectId, ref: "Policy", default: null },
    fulfillmentStatus: {
      type: String,
      enum: ["pending_payment", "blocked_pending_authority", "issued"],
      default: "pending_payment",
    },
    processedEventIds: { type: [String], default: [] },
    confirmationEmailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    // Server-generated snapshot survives the quote collection's TTL expiry.
    documentSnapshot: { type: Schema.Types.Mixed, default: null },
    // Cache exact body/attachment bytes so retries use an identical provider payload.
    confirmationEmailPayload: { type: Schema.Types.Mixed, default: null, select: false },
    confirmationEmailClaim: String,
    confirmationEmailClaimedAt: Date,
    confirmationEmailFirstAttemptAt: Date,
    confirmationEmailNextRetryAt: Date,
    confirmationEmailAttempts: { type: Number, default: 0 },
    confirmationEmailId: String,
    confirmationEmailError: String,
  },
  { timestamps: true, collection: "tempify_orders" },
);

orderSchema.index({ paymegateOrderUUID: 1 }, { sparse: true });

export const Order = models.Order || model("Order", orderSchema);
