import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { contactMessageSchema } from "@/modules/contact/schema";
import { sendContactSupportEmail } from "@/modules/email/service";

export const runtime = "nodejs";

const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;

type ChallengePayload = {
  left: number;
  right: number;
  expiresAt: number;
  nonce: string;
};

export async function GET(request: Request) {
  try {
    const limiter = rateLimit(`contact-challenge:${clientIp(request)}`, 30, 60_000);
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const left = randomInt(2, 10);
    const right = randomInt(2, 10);
    const payload: ChallengePayload = {
      left,
      right,
      expiresAt: Date.now() + CHALLENGE_LIFETIME_MS,
      nonce: randomBytes(12).toString("base64url"),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = sign(encoded);

    return NextResponse.json(
      { question: `What is ${left} + ${right}?`, token: `${encoded}.${signature}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error, "The verification challenge is temporarily unavailable.");
  }
}

export async function POST(request: Request) {
  try {
    const limiter = rateLimit(`contact-submit:${clientIp(request)}`, 5, 10 * 60_000);
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many messages. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const input = contactMessageSchema.parse(await request.json());

    // Quietly accept honeypot submissions so automated spam does not learn how
    // the form filters requests. No email is sent in this branch.
    if (input.website) {
      return NextResponse.json({ success: true, message: "Your message has been sent." });
    }

    if (!verifyChallenge(input.challengeToken, input.challengeAnswer)) {
      return NextResponse.json(
        { error: "The robot-verification answer is incorrect or expired. Please try the new question." },
        { status: 400 },
      );
    }

    await sendContactSupportEmail(input);
    return NextResponse.json({
      success: true,
      message: "Thanks — your message has been sent. We aim to respond within 24 hours.",
    });
  } catch (error) {
    return apiError(error, "We could not send your message. Please try again.");
  }
}

function sign(value: string) {
  return createHmac("sha256", challengeSecret()).update(value).digest("base64url");
}

function verifyChallenge(token: string, answer: number) {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return false;

  const expected = Buffer.from(sign(encoded), "base64url");
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ChallengePayload;
    return Number.isInteger(payload.left)
      && Number.isInteger(payload.right)
      && Number.isFinite(payload.expiresAt)
      && payload.expiresAt >= Date.now()
      && answer === payload.left + payload.right;
  } catch {
    return false;
  }
}

function challengeSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return `tempify-contact:${secret}`;
  if (process.env.NODE_ENV !== "production") return "tempify-contact-development-only-secret";
  throw new ContactConfigurationError();
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

class ContactConfigurationError extends Error {
  status = 503;

  constructor() {
    super("The contact form is temporarily unavailable.");
  }
}
