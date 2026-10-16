import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { batchSend, emailSend } = vi.hoisted(() => ({
  batchSend: vi.fn(),
  emailSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    batch = { send: batchSend };
    emails = { send: emailSend };
  },
}));

import { samplePolicy } from "@/modules/policy-documents/fixture";

import {
  buildContactEmailBatch,
  sendContactMessageEmails,
  sendPaymentConfirmationEmail,
  preparePaymentDocumentEmail,
} from "./service";

const input = {
  firstName: "Ava",
  lastName: "O'Neil",
  email: "ava@example.com",
  subject: "Quote <question>",
  message: "Please explain <this>.\nThank you.",
};

describe("contact email delivery", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_DELIVERY_MODE = "resend";
    process.env.EMAIL_FROM = "Cuvvafy <auto@cuvvapolicies.com>";
    process.env.CONTACT_TO_EMAIL = "support@example.com";
    delete process.env.PAYMENT_EMAIL_FROM;
    batchSend.mockReset();
    emailSend.mockReset();
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_DELIVERY_MODE;
    delete process.env.EMAIL_FROM;
    delete process.env.PAYMENT_EMAIL_FROM;
    delete process.env.CONTACT_TO_EMAIL;
  });

  it("builds a support notification and a separate customer acknowledgement", () => {
    const emails = buildContactEmailBatch(input);

    expect(emails).toHaveLength(2);
    expect(emails[0]).toMatchObject({
      to: ["support@example.com"],
      replyTo: "ava@example.com",
      subject: "[Cuvvafy support] Quote <question>",
    });
    expect(emails[1]).toMatchObject({
      to: ["ava@example.com"],
      subject: "We received your Cuvvafy message",
    });
    expect(emails[1]).not.toHaveProperty("replyTo");
    expect(emails[0].html).toContain("Quote &lt;question&gt;");
    expect(emails[0].html).toContain("Please explain &lt;this&gt;.<br>Thank you.");
    expect(emails[1].html).toContain("does not create a payment, insurance policy or insurance cover");
  });

  it("submits both emails through one Resend batch request", async () => {
    batchSend.mockResolvedValue({
      data: [{ id: "support-id" }, { id: "customer-id" }],
      error: null,
    });

    await expect(sendContactMessageEmails(input)).resolves.toEqual([
      { id: "support-id" },
      { id: "customer-id" },
    ]);

    expect(batchSend).toHaveBeenCalledTimes(1);
    expect(batchSend).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ to: ["support@example.com"] }),
        expect.objectContaining({ to: ["ava@example.com"] }),
      ]),
    );
  });

  it("fails the form submission if Resend rejects the batch", async () => {
    batchSend.mockResolvedValue({
      data: null,
      error: { message: "Batch rejected" },
    });

    await expect(sendContactMessageEmails(input)).rejects.toThrow("Batch rejected");
  });

  it("uses the exact existing Cuvva sender for post-payment email only", async () => {
    emailSend.mockResolvedValue({ data: { id: "payment-id" }, error: null });

    const payload = await preparePaymentDocumentEmail({
      orderId: samplePolicy.policy._id, email: samplePolicy.customer.email,
      amount: samplePolicy.policy.premiumAmount, currency: "GBP", documentSnapshot: samplePolicy,
    });
    await sendPaymentConfirmationEmail({ orderId: samplePolicy.policy._id, payload });

    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Cuvva <auto@cuvvapolicies.com>", to: samplePolicy.customer.email }),
      expect.objectContaining({ idempotencyKey: `tempify-payment-documents/${samplePolicy.policy._id}/v1` }),
    );
    expect(payload.attachments.filter((attachment) => attachment.contentType === "application/pdf")).toHaveLength(3);
    expect(payload.subject).not.toContain("SAMPLE — NOT");
    expect(payload.html).toContain("sample documents");

    const contactEmails = buildContactEmailBatch(input);
    expect(contactEmails[0].from).toBe("Cuvvafy <auto@cuvvapolicies.com>");
    expect(contactEmails[1].from).toBe("Cuvvafy <auto@cuvvapolicies.com>");
  });
});
