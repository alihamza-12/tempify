import { Types } from "mongoose";
import type { Collection, Document } from "mongodb";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models/Order";
import { Policy } from "@/models/Policy";
import { Quote } from "@/models/Quote";
import { User } from "@/models/User";
import { getStripeCardLast4 } from "./stripe";
import { parseSharedIntegrationOwnerId } from "@/modules/vehicles/service";

const UNDERWRITER = "Wakam" as const;
const POLICY_TYPE = "Temporary Car" as const;
const COVERAGE_TYPE = "Comprehensive" as const;
const EXCESS = 500;
const LONDON = "Europe/London";
const END_MINUTE_GRACE_MS = 60_000 - 1;
const DAY_MS = 24 * 60 * 60_000;

type SyncResult = { issued: boolean; retryable: boolean; policyId?: string };

/**
 * Create the same `policies` collection record consumed by Cuvva's customer
 * and super-admin routes. It is only called after Stripe has confirmed a paid
 * Checkout Session. A unique Tempify order key makes webhook/status retries
 * idempotent without changing the Cuvva project.
 */
export async function ensureCuvvaPolicyForOrder(orderId: string): Promise<SyncResult> {
  if (process.env.LIVE_POLICY_CHECKOUT_ENABLED !== "true") {
    return { issued: false, retryable: false };
  }

  const mongoose = await connectToDatabase();
  await Policy.collection.createIndex({ tempifyOrderId: 1 }, { unique: true, sparse: true, name: "tempifyOrderId_1" });
  const order = await Order.findById(orderId);
  if (!order || order.status !== "paid") return { issued: false, retryable: false };

  if (order.policyId) {
    const linked = await Policy.findById(order.policyId).select("_id").lean();
    if (linked) return { issued: true, retryable: false, policyId: String(linked._id) };
  }

  const orderKey = String(order._id);
  const alreadyCreated = await Policy.findOne({ tempifyOrderId: orderKey }).select("_id policyNumber").lean();
  if (alreadyCreated) {
    await attachPolicyToOrder(order, alreadyCreated._id);
    return { issued: true, retryable: false, policyId: String(alreadyCreated._id) };
  }

  const quote = await Quote.findById(order.quoteId).lean();
  if (quote && String(quote.userId) !== String(order.userId)) {
    return fail(orderKey, "The paid quote does not belong to the order customer.");
  }
  const vehicleId = order.vehicleId || quote?.vehicleId;
  const coverStartAt = order.coverStartAt || quote?.cover?.startAt;
  const coverEndAt = order.coverEndAt || quote?.cover?.endAt;
  if (!vehicleId || !coverStartAt || !coverEndAt) {
    return fail(orderKey, "The paid order is missing its saved vehicle or cover snapshot.");
  }

  const [customer, vehicle] = await Promise.all([
    User.findById(order.userId).lean(),
    mongoose.connection.collection("vehicles").findOne({ _id: vehicleId }),
  ]);
  if (!customer || customer.role !== "Customer" || !customer.fullName?.trim() || !customer.dateOfBirth || !customer.drivingLicenceNumber?.trim()) {
    return fail(orderKey, "The shared Cuvva customer record is missing required policy details.");
  }
  if (!vehicle || !String(vehicle.registration || "").trim() || !String(vehicle.vehicleIdentificationNumber || "").trim()) {
    return fail(orderKey, "The verified vehicle is not present with required fields in the shared Cuvva vehicles collection.");
  }

  // Match Cuvva's admin-created policy semantics. Prefer the active Super
  // Admin who created the already-shared vehicle, then fall back to the
  // explicitly configured integration owner.
  const creatorCandidates: Types.ObjectId[] = [];
  if (vehicle.createdBy && Types.ObjectId.isValid(String(vehicle.createdBy))) {
    creatorCandidates.push(new Types.ObjectId(String(vehicle.createdBy)));
  }
  try {
    const configuredOwnerId = parseSharedIntegrationOwnerId();
    if (!creatorCandidates.some((candidate) => candidate.equals(configuredOwnerId))) creatorCandidates.push(configuredOwnerId);
  } catch {
    // A valid vehicle creator can still be used when an old env value is stale.
  }
  let ownerId: Types.ObjectId | null = null;
  for (const candidate of creatorCandidates) {
    const owner = await User.findOne({ _id: candidate, role: "Super Admin", status: "Active" }).select("_id").lean();
    if (owner) {
      ownerId = new Types.ObjectId(String(owner._id));
      break;
    }
  }
  if (!ownerId) return fail(orderKey, "Neither the shared vehicle creator nor SHARED_INTEGRATION_OWNER_ID is an active Cuvva Super Admin.");

  const startAt = new Date(coverStartAt);
  const endAt = new Date(coverEndAt);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt >= endAt) {
    return fail(orderKey, "The policy cover window is invalid.");
  }

  const start = londonParts(startAt);
  const end = londonParts(new Date(endAt.getTime() - 60_000));
  const startDate = dateAtLondonMidnight(start.date);
  const endDate = dateAtLondonMidnight(end.date);
  const status = startAt > new Date() ? "Upcoming" : endAt >= new Date() ? "Active" : "Expired";

  const conflict = await hasCoverConflict(mongoose.connection.collection("policies"), {
    customerId: customer._id,
    vehicleId,
    startAt,
    endAt,
  });
  if (conflict) {
    const concurrentPolicy = await Policy.findOne({ tempifyOrderId: orderKey }).select("_id").lean();
    if (concurrentPolicy) {
      await attachPolicyToOrder(order, concurrentPolicy._id);
      return { issued: true, retryable: false, policyId: String(concurrentPolicy._id) };
    }
    return fail(orderKey, "An existing Cuvva policy overlaps this customer or vehicle cover window.");
  }

  let cardLast4: string;
  try {
    const paymentIntentId = order.stripePaymentIntentId || order.transactionUUID;
    if (!paymentIntentId?.startsWith("pi_")) throw new Error("Missing Stripe PaymentIntent ID.");
    cardLast4 = await getStripeCardLast4(paymentIntentId);
  } catch {
    return fail(orderKey, "Stripe did not return card last-four details for the paid transaction.");
  }

  const policyData = {
    customerId: customer._id,
    vehicleId,
    createdBy: ownerId,
    premiumAmount: order.amount,
    excess: EXCESS,
    cardLast4,
    startDate,
    endDate,
    startTime: start.time,
    endTime: end.time,
    policyType: POLICY_TYPE,
    coverageType: COVERAGE_TYPE,
    underwriter: UNDERWRITER,
    status,
    internalNotes: `Created by Tempify for verified order ${order.publicId}`,
    tempifyOrderId: orderKey,
  };

  try {
    const policy = await Policy.create(policyData);
    await User.updateOne({ _id: customer._id }, { $set: { lastFourDigits: cardLast4 } }, { runValidators: true });
    await attachPolicyToOrder(order, policy._id);
    return { issued: true, retryable: false, policyId: String(policy._id) };
  } catch (error) {
    // Another concurrent webhook may have inserted the unique order key.
    if (isDuplicateKey(error)) {
      const winner = await Policy.findOne({ tempifyOrderId: orderKey }).select("_id policyNumber").lean();
      if (winner) {
        await attachPolicyToOrder(order, winner._id);
        return { issued: true, retryable: false, policyId: String(winner._id) };
      }
    }
    return fail(orderKey, "Could not persist the Cuvva-compatible policy record.");
  }
}

async function attachPolicyToOrder(order: { _id: Types.ObjectId }, policyId: Types.ObjectId) {
  await Order.updateOne(
    { _id: order._id, status: "paid" },
    { $set: { policyId, fulfillmentStatus: "issued" } },
  );
}

async function fail(orderKey: string, safeReason: string): Promise<SyncResult> {
  console.error("[policy:sync] Tempify-to-Cuvva policy sync requires review", { orderKey, reason: safeReason });
  return { issued: false, retryable: true };
}

function isDuplicateKey(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000);
}

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (name: string) => parts.find((part) => part.type === name)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function dateAtLondonMidnight(date: string) {
  // Cuvva stores calendar dates at UTC midnight and interprets the time fields
  // in Europe/London, matching its existing policy-create endpoint.
  return new Date(`${date}T00:00:00.000Z`);
}

function londonInstant(dateValue: unknown, timeValue: unknown): Date | null {
  const date = new Date(dateValue as string | Date);
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(timeValue || ""));
  if (!Number.isFinite(date.getTime()) || !match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const desired = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute);
  let instant = new Date(desired);
  for (let index = 0; index < 3; index += 1) {
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(instant);
    const values = Object.fromEntries(local.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
    instant = new Date(desired - (represented - instant.getTime()));
  }
  return instant;
}

async function hasCoverConflict(collection: Collection<Document>, candidate: { customerId: Types.ObjectId; vehicleId: Types.ObjectId; startAt: Date; endAt: Date }) {
  const policies = await collection.find({
    $or: [{ customerId: candidate.customerId }, { vehicleId: candidate.vehicleId }],
    status: { $in: ["Upcoming", "Active"] },
  }, { projection: { customerId: 1, vehicleId: 1, startDate: 1, endDate: 1, startTime: 1, endTime: 1, status: 1, policyNumber: 1 } }).toArray();
  for (const policy of policies) {
    const start = londonInstant(policy.startDate, policy.startTime);
    const endAtMinute = londonInstant(policy.endDate, policy.endTime);
    if (!start || !endAtMinute) continue;
    let endMs = endAtMinute.getTime();
    while (endMs <= start.getTime()) endMs += DAY_MS;
    endMs += END_MINUTE_GRACE_MS;
    const sameVehicle = String(policy.vehicleId) === String(candidate.vehicleId);
    const sameCustomer = String(policy.customerId) === String(candidate.customerId);
    if ((sameVehicle || sameCustomer) && candidate.startAt.getTime() < endMs && candidate.endAt.getTime() > start.getTime()) return true;
  }
  return false;
}

