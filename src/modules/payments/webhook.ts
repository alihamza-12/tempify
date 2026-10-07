import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPayMeGateWebhook(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}) {
  const secret = process.env.PAYMEGATE_WEBHOOK_SECRET;
  if (!secret || !input.signature || !input.timestamp) return false;

  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("base64url");

  const suppliedBuffer = Buffer.from(input.signature);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}
