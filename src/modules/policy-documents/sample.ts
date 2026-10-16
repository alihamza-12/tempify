import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Keep the original template unobscured: no diagonal watermark or red strip.
 * A plain sample footer remains on every page because preview data is fictional
 * and these files are not issued insurance documents.
 */
export async function watermarkSamplePdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const page of pdf.getPages()) {
    const { width } = page.getSize();
    const label = "SAMPLE - NOT VALID INSURANCE - NO POLICY ISSUED";
    const size = Math.min(9, (width - 30) / font.widthOfTextAtSize(label, 1));
    const labelWidth = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: (width - labelWidth) / 2,
      y: 10,
      size,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
  }
  pdf.setTitle("SAMPLE - NOT VALID INSURANCE");
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
  const notice = paymentConfirmed
    ? "Payment received. The attached documents are SAMPLES ONLY. No insurance policy or cover has been issued. Do not drive in reliance on this payment or these documents."
    : "Local template preview. Fictional details. No insurance policy or cover has been issued.";
  const banner = `<div style="padding:18px;background:#a10a18;color:white;text-align:center;font:700 15px/1.5 Arial,sans-serif">SAMPLE — NOT VALID INSURANCE<br><span style="font-size:12px;font-weight:400">${notice}</span></div>`;
  bundle.html = bundle.html.replace(/(<body\b[^>]*>)/i, `$1${banner}`)
    .replace("We've attached your policy documents to this email. You'll also find them in the app.", "We've attached your sample documents to this email. These are not issued insurance documents.");
  bundle.subject = `${paymentConfirmed ? "Payment confirmed — " : ""}SAMPLE documents — ${bundle.subject}`;
  return bundle;
}
