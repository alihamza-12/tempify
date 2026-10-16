import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { buildSamplePolicyBundle } from "../src/modules/policy-documents/sample";
import { samplePolicy } from "../src/modules/policy-documents/fixture";

async function main() {
  const output = path.resolve(process.argv[2] || "previews/cuvva-policy");
  await mkdir(output, { recursive: true });
  const bundle = await buildSamplePolicyBundle(samplePolicy);
  const documents = [];
  for (const attachment of bundle.attachments) {
    if (attachment.contentType !== "application/pdf") continue;
    await writeFile(path.join(output, attachment.filename), attachment.content);
    documents.push(attachment);
  }
  const emailHtml = bundle.html;
  let previewHtml = emailHtml;
  for (const attachment of bundle.attachments) {
    if (attachment.cid) previewHtml = previewHtml.replaceAll(`cid:${attachment.cid}`, `data:${attachment.contentType};base64,${attachment.content.toString("base64")}`);
  }
  const downloadLinks = documents.map((doc) => `<a download="${doc.filename}" href="data:application/pdf;base64,${doc.content.toString("base64")}" style="display:block;margin:8px 0;color:#fff;font:13px Arial,sans-serif">Download SAMPLE: ${doc.filename}</a>`).join("");
  previewHtml = previewHtml.replace(/(<body\b[^>]*>)/i, `$1<div style="padding:14px 24px;background:#2d3140;color:#fff">${downloadLinks}</div>`);
  await writeFile(path.join(output, "email-preview.html"), previewHtml);

  // Stream transport serializes a real multipart MIME message entirely locally.
  // It cannot connect to SMTP and needs no credentials.
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const message = await transport.sendMail({
    ...bundle,
    from: "Cuvva Template Preview <preview@example.invalid>",
    subject: bundle.subject,
    html: emailHtml,
    headers: { "X-Tempify-Preview": "sample-not-valid-insurance" },
  });
  await writeFile(path.join(output, "sample-policy-email.eml"), message.message);
  await writeFile(path.join(output, "README.txt"), "LOCAL TEMPLATE PREVIEW ONLY\n\nAll PDFs use fictional data and the original document layout.\nemail-preview.html embeds the same logo, badges and icons for offline viewing.\nsample-policy-email.eml is an unsent MIME message with all three PDFs and inline assets; open in a compatible mail client.\nNo SMTP connection, payment, database write or policy issuance occurred.\nThe original source and static PDFs remain unchanged in vendor/cuvva.\n");
  console.log(`Local preview written to ${output}. No email sent; no policy issued.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
