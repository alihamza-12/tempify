import { PDFDocument } from "pdf-lib";

/**
 * Keep the original template unobscured: no diagonal watermark or red strip.
 * The original PDF layout remains unchanged.
 */
export async function watermarkSamplePdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  // The former sample footer and sample PDF title are intentionally disabled.
  pdf.setTitle("Policy documents");
  pdf.setSubject("Local template preview only. No payment or policy was created.");
  return Buffer.from(await pdf.save());
}

import { buildPolicyBundle } from "./bundle";

/** Always mark ALL three PDFs. No unmarked certificate is sent after payment. */
export async function buildSamplePolicyBundle(input: unknown, paymentConfirmed = false) {
  const bundle = await buildPolicyBundle(input);
  for (const attachment of bundle.attachments) {
    if (attachment.contentType === "application/pdf") {
      attachment.content = await watermarkSamplePdf(attachment.content);
    }
  }
  bundle.html = bundle.html
    .replace("We've attached your policy documents to this email. You'll also find them in the app.", "We've attached your sample documents to this email. These are not issued insurance documents.");
  bundle.subject = `${paymentConfirmed ? "Payment confirmed — " : ""}SAMPLE documents — ${bundle.subject}`;
  return bundle;
}
