import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPolicyBundle, emailDataForPolicy } from "./bundle";
import { samplePolicy } from "./fixture";
import { policyDocumentSchema } from "./schema";
import { watermarkSamplePdf } from "../../../scripts/lib/preview-watermark";

const root = path.join(process.cwd(), "vendor/cuvva");
const requireSource = createRequire(path.join(root, "package.json"));
const originalEmail = requireSource("./utils/sendEmail.js");
const originalPdf = requireSource("./services/pdf/generatePolicyCertificate.js");

describe("exact-source Cuvva email and policy documents", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps every copied source, PDF, image and font byte-identical to the recorded source revision", () => {
    const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));
    expect(manifest.commit).toBe("fe51b0979ca8b94d3552792305e57955bf9dd5f0");
    for (const [name, hash] of Object.entries(manifest.files)) {
      expect(createHash("sha256").update(readFileSync(path.join(root, name))).digest("hex"), name).toBe(hash);
    }
  });

  it("renders the original card-payment email HTML, not the Tempify receipt shell", async () => {
    const input = { ...samplePolicy, payment: { method: "card" as const, brand: "Card", last4: "1234" } };
    const bundle = await buildPolicyBundle(input);
    expect(bundle.html).toBe(originalEmail.buildPolicyEmailHtml(emailDataForPolicy(input)));
    expect(bundle.subject).toBe("Your Cuvva policy (SAMPLE-NOT-VALID-001)");
    expect(bundle.html).toContain("Paid with Card ending 1234");
    expect(bundle.html).not.toContain("Your payment has been verified");
    expect(bundle.attachments).toHaveLength(13);
  });

  it("renders a dynamic four-page PDF identical to direct Cuvva generation for the same input and creation time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T00:00:00Z"));
    const bundle = await buildPolicyBundle(samplePolicy);
    const expected = await originalPdf.generatePolicyCertificatePdf(samplePolicy);
    expect(bundle.attachments[0].content.equals(expected)).toBe(true);
    const pdf = await PDFDocument.load(bundle.attachments[0].content);
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe("Policy details and certificate");
  });

  it("attaches the actual two static PDFs without replacing or regenerating them", async () => {
    const bundle = await buildPolicyBundle(samplePolicy);
    expect(bundle.attachments.slice(0, 3).map((attachment) => attachment.filename)).toEqual([
      "Policy details and certificate.pdf", "Policy wording (full terms).pdf", "Insurance summary (IPID).pdf",
    ]);
    for (const attachment of bundle.attachments.slice(1, 3)) {
      expect(attachment.content.equals(readFileSync(path.join(root, "pdfs", attachment.filename)))).toBe(true);
    }
  });

  it("includes an inline asset for every referenced email CID", async () => {
    const bundle = await buildPolicyBundle(samplePolicy);
    const cids = [...bundle.html.matchAll(/src="cid:([^"]+)"/g)].map((match) => match[1]);
    for (const cid of cids) expect(bundle.attachments.some((attachment) => attachment.cid === cid && attachment.content.length > 0)).toBe(true);
  });

  it("does not invent card details or a card icon for a PayMeGate payment", async () => {
    const bundle = await buildPolicyBundle(samplePolicy);
    expect(bundle.html).toContain("Paid via PayMeGate");
    expect(bundle.html).not.toContain("ending Not provided");
    expect(bundle.html).not.toContain("cid:iconMastercard");
    expect(bundle.attachments.some((attachment) => attachment.cid === "iconMastercard")).toBe(false);
  });

  it("escapes customer data without changing the template markup", async () => {
    const bundle = await buildPolicyBundle({ ...samplePolicy, customer: { ...samplePolicy.customer, firstName: "<script>alert(1)</script>" } });
    expect(bundle.html).not.toContain("<script>");
    expect(bundle.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("preserves the admin flow's inclusive final-minute email duration", () => {
    const data = emailDataForPolicy(samplePolicy);
    expect(data.duration).toBe("2 hours");
    expect(data.startDateStr).toBe("Tue 15 Jan at 10am");
    expect(data.endDateStr).toBe("Tue 15 Jan at 11:59am");
  });

  it("refuses to use the Wakam-specific certificate for another underwriter", () => {
    expect(policyDocumentSchema.safeParse({ ...samplePolicy, policy: { ...samplePolicy.policy, underwriter: "ERS Syndicate" } }).success).toBe(false);
  });

  it("refuses missing document details and invalid periods or money", () => {
    expect(policyDocumentSchema.safeParse({ ...samplePolicy, vehicle: { ...samplePolicy.vehicle, vehicleIdentificationNumber: "" } }).success).toBe(false);
    expect(policyDocumentSchema.safeParse({ ...samplePolicy, policy: { ...samplePolicy.policy, endTime: "09:59" } }).success).toBe(false);
    expect(policyDocumentSchema.safeParse({ ...samplePolicy, policy: { ...samplePolicy.policy, premiumAmount: 25.001 } }).success).toBe(false);
    expect(policyDocumentSchema.safeParse({ ...samplePolicy, policy: { ...samplePolicy.policy, startDate: "2030-02-31" } }).success).toBe(false);
  });

  it("produces visibly marked sample PDFs without changing the original bundle", async () => {
    const bundle = await buildPolicyBundle(samplePolicy);
    const original = Buffer.from(bundle.attachments[0].content);
    const sample = await watermarkSamplePdf(original);
    const pdf = await PDFDocument.load(sample);
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe("SAMPLE - NOT VALID INSURANCE");
    expect(sample.equals(original)).toBe(false);
    expect(bundle.attachments[0].content.equals(original)).toBe(true);
  });
});
