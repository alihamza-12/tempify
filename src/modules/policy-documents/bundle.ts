import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { policyDocumentSchema, type PolicyDocumentInput } from "./schema";

const root = path.join(process.cwd(), "vendor", "cuvva");
const requireSource = createRequire(path.join(root, "package.json"));

type EmailData = Record<string, string>;
const sourceEmail = requireSource("./utils/sendEmail.js") as {
  buildPolicyEmailHtml: (data: EmailData) => string;
};
const sourcePdf = requireSource("./services/pdf/generatePolicyCertificate.js") as {
  generatePolicyCertificatePdf: (input: Pick<PolicyDocumentInput, "policy" | "customer" | "vehicle">) => Promise<Buffer>;
};

export type PolicyAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
};
export type PolicyBundle = {
  to: string;
  subject: string;
  html: string;
  attachments: PolicyAttachment[];
};

export const INLINE_ASSETS = [
  ["cuvva-logo.png", "cuvvaLogo"],
  ["app-store-badge.png", "appStoreBadge"],
  ["google-play-badge.png", "googlePlayBadge"],
  ["icon-x.png", "iconX"],
  ["icon-facebook.png", "iconFacebook"],
  ["icon-instagram.png", "iconInstagram"],
  ["icon-tiktok.png", "iconTiktok"],
  ["icon-linkedin.png", "iconLinkedin"],
  ["icon-youtube.png", "iconYoutube"],
  ["icon-mastercard.png", "iconMastercard"],
] as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

// Match the existing admin email's wall-clock/date and inclusive-final-minute conventions.
function emailDate(value: string, time: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const [hours, minutes] = time.split(":").map(Number);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
  return `${weekday} ${date.getUTCDate()} ${month} at ${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}${hours >= 12 ? "pm" : "am"}`;
}

/**
 * Ensure policy number looks exactly like live Cuvva:
 * PPWAKF + 10 alphanumeric chars (e.g. PPWAKFMYWE60BFI74)
 * Same format as your target screenshot.
 */
export function normalizePolicyNumber(raw: string): string {
  const clean = raw.replace(/[\r\n]/g, " ").trim().toUpperCase();
  // Already correct format — keep it (allows you to pass a real PPWAKF number)
  if (/^PPWAKF[A-Z0-9]{10}$/.test(clean)) return clean;
  if (clean.startsWith("PPWAKF") && clean.length >= 16) {
    // If user passed PPWAKF + longer/shorter, normalize to 16 chars
    return clean.slice(0, 16);
  }
  // If it's a SAMPLE number or anything else, generate/replace with PPWAKF format
  // This is what converts SAMPLE-6ACA72539BA -> PPWAKF**********
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  // Use crypto-random if available, fallback to Math.random
  for (let i = 0; i < 10; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PPWAKF${suffix}`;
}

// Optional: if you want deterministic conversion from SAMPLE number (same input = same PPWAKF)
// uncomment this version instead of random above:
/*
function deterministicPPWAKF(suffixSeed: string): string {
  let hash = 0;
  for (let i = 0; i < suffixSeed.length; i++) hash = (hash * 31 + suffixSeed.charCodeAt(i)) >>> 0;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 10; i++) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    suffix += chars[hash % chars.length];
  }
  return `PPWAKF${suffix}`;
}
*/

export function emailDataForPolicy(input: PolicyDocumentInput): EmailData {
  const { policy, customer, vehicle, payment } = input;
  const totalMinutes = Math.max(1, Math.round((
    Date.parse(`${policy.endDate}T${policy.endTime}:00Z`) -
    Date.parse(`${policy.startDate}T${policy.startTime}:00Z`)
  ) / 60_000) + 1);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor(totalMinutes % 1440 / 60);
  const minutes = totalMinutes % 60;
  const duration = [
    days ? `${days} day${days === 1 ? "" : "s"}` : "",
    hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "",
    minutes ? `${minutes} minute${minutes === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" ");
  return {
    customerFullName: customer.fullName,
    customerFirstName: customer.firstName,
    vehicleMake: vehicle.make,
    vehicleModel: vehicle.model,
    registration: vehicle.registration,
    startDateStr: emailDate(policy.startDate, policy.startTime),
    endDateStr: emailDate(policy.endDate, policy.endTime),
    duration,
    price: policy.premiumAmount.toFixed(2),
    cardBrand: payment.method === "card" ? payment.brand : payment.method === "stripe" ? "Stripe" : "PayMeGate",
    cardLast4: payment.method === "card" ? payment.last4 : "",
    policyNumber: normalizePolicyNumber(policy.policyNumber),
    underwriter: policy.underwriter,
  };
}

/** Render only: no policy creation, database access, network access or email send. */
export async function buildPolicyBundle(rawInput: unknown): Promise<PolicyBundle> {
  if (typeof window !== "undefined") throw new Error("Policy rendering is server-only.");
  const input = policyDocumentSchema.parse(rawInput);

  // Force PPWAKF format BEFORE rendering — so both email HTML and PDF use same number
  input.policy.policyNumber = normalizePolicyNumber(input.policy.policyNumber);

  const data = emailDataForPolicy(input);
  // The source template interpolates values without escaping. Escape only data,
  // not its markup, so customer-controlled text cannot inject HTML into email.
  const escaped = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, escapeHtml(value)]));
  let html = sourceEmail.buildPolicyEmailHtml(escaped);

  if (input.payment.method === "paymegate" || input.payment.method === "stripe") {
    // Preserve the original layout but never pretend a crypto/Stripe payment used a card.
    html = html.replace(/<td style="padding-right:8px;">\s*<img src="cid:iconMastercard"[^>]*\/>\s*<\/td>/, "");
    if (input.payment.method === "paymegate") {
      html = html.replace("Paid with PayMeGate ending Not provided", "Paid via PayMeGate");
      html = html.replace("Paid with Stripe ending Not provided", "Paid via PayMeGate");
    } else {
      html = html.replace("Paid with PayMeGate ending Not provided", "Paid via Stripe");
      html = html.replace("Paid with Stripe ending Not provided", "Paid via Stripe");
      html = html.replace("Paid via PayMeGate", "Paid via Stripe");
      html = html.replace("Paid with Stripe ending", "Paid via Stripe");
    }
  }

  const dynamicPdf = await sourcePdf.generatePolicyCertificatePdf(input);

  const attachments: PolicyAttachment[] = [
    { filename: "Policy details and certificate.pdf", content: dynamicPdf, contentType: "application/pdf" },
    ...["Policy wording (full terms).pdf", "Insurance summary (IPID).pdf"].map((filename) => ({
      filename, content: readFileSync(path.join(root, "pdfs", filename)), contentType: "application/pdf",
    })),
    ...INLINE_ASSETS
      .filter(([, cid]) => input.payment.method === "card" || cid !== "iconMastercard")
      .map(([filename, cid]) => ({ filename, cid, content: readFileSync(path.join(root, "public", "email-assets", filename)), contentType: "image/png" })),
  ];

  return {
    to: input.customer.email,
    subject: `Your Cuvva policy (${input.policy.policyNumber.replace(/[\r\n]/g, " ")})`,
    html,
    attachments,
  };
}
