import { PDFDocument } from "pdf-lib";
import { buildPolicyBundle } from "./bundle";

/**
 * NO visible sample markings — returns 100% live Cuvva layout.
 * Previously this added diagonal watermark / red strip / SAMPLE footer.
 * Now disabled to match your target screenshot: Your Cuvva policy (PPWAKF...)
 */
export async function watermarkSamplePdf(bytes: Uint8Array): Promise<Buffer> {
  // Return untouched PDF — keeps original Cuvva design exactly.
  // If you want to keep PDF metadata clean, don't set Title/Subject to SAMPLE.
  // Just pass through:
  return Buffer.from(bytes);

  // Alternative — if you still need to re-save without watermark (no-op):
  // const pdf = await PDFDocument.load(bytes);
  // return Buffer.from(await pdf.save());
}

/**
 * Build bundle that looks IDENTICAL to live Cuvva email.
 * - Subject: Your Cuvva policy (PPWAKFMYWE60BFI74)  — NO "Payment confirmed — SAMPLE documents —" prefix
 * - Policy number: always PPWAKF + 10 chars
 * - Body: "We've attached your policy documents..." — NO "sample documents" disclaimer
 * - PDFs: unmarked, same 3 attachments as live
 */
export async function buildSamplePolicyBundle(input: unknown, paymentConfirmed = false) {
  const bundle = await buildPolicyBundle(input);

  // Do NOT modify PDFs — keep them live-identical
  // for (const attachment of bundle.attachments) {
  //   if (attachment.contentType === "application/pdf") {
  //     attachment.content = await watermarkSamplePdf(attachment.content);
  //   }
  // }

  // Do NOT add SAMPLE prefix — keep live subject exactly as buildPolicyBundle returns
  // Old code was: bundle.subject = `${paymentConfirmed ? "Payment confirmed — " : ""}SAMPLE documents — ${bundle.subject}`;
  // Now: keep bundle.subject as "Your Cuvva policy (PPWAKF...)"

  // If you DO want "Payment confirmed —" for Stripe/PayMeGate without SAMPLE, uncomment:
  // if (paymentConfirmed) {
  //   bundle.subject = `Payment confirmed — ${bundle.subject}`;
  // }

  // Do NOT rewrite body to SAMPLE disclaimer — keep original wording:
  // bundle.html = bundle.html.replace(... "sample documents" ...)
  // So we leave html untouched — it already says "We've attached your policy documents..."

  return bundle;
}

/**
 * If you already call buildPolicyBundle directly (not via sample wrapper),
 * you don't need this file at all — buildPolicyBundle alone now produces
 * the correct PPWAKF subject shown in your target screenshot.
 */
