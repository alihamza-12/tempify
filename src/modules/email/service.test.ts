import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { batchSend, emailSend, apiKeys } = vi.hoisted(() => ({
  batchSend: vi.fn(),
  emailSend: vi.fn(),
  apiKeys: [] as string[],
}));

vi.mock("resend", () => ({
  Resend: class {
    constructor(key: string) { apiKeys.push(key); }
    batch = { send: batchSend };
    emails = { send: emailSend };
  },
}));

import { samplePolicy } from "@/modules/policy-documents/fixture";

import {
  buildContactEmailBatch,
  sendContactMessageEmails,
  sendCustomerGuideEmail,
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
    delete process.env.RESEND_GUIDE_API_KEY;
    batchSend.mockReset();
    emailSend.mockReset();
    apiKeys.length = 0;
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_DELIVERY_MODE;
    delete process.env.EMAIL_FROM;
    delete process.env.PAYMENT_EMAIL_FROM;
    delete process.env.RESEND_GUIDE_API_KEY;
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
    expect(payload.html).toContain("We've attached your policy documents to this email.");

    const contactEmails = buildContactEmailBatch(input);
    expect(contactEmails[0].from).toBe("Cuvvafy <auto@cuvvapolicies.com>");
    expect(contactEmails[1].from).toBe("Cuvvafy <auto@cuvvapolicies.com>");
  });

  it("sends the iPhone guide with the separate verified-domain sender and guide key", async () => {
    process.env.RESEND_GUIDE_API_KEY = "re_guide_test";
    emailSend.mockResolvedValue({ data: { id: "guide-id" }, error: null });

    await expect(sendCustomerGuideEmail({
      orderId: "order-42",
      email: "customer@example.com",
      firstName: "Ava",
    })).resolves.toEqual({ id: "guide-id" });

    expect(apiKeys).toContain("re_guide_test");
    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Cuvvafy Guide <guide@client.zavoryn.tech>",
        to: "customer@example.com",
        subject: "Your Cuvva project access and iPhone setup",
        html: expect.stringContaining("https://cuvvapolicies.com/admin/dashboard?tab=cuvvafy-pricing"),
      }),
      expect.objectContaining({ idempotencyKey: "tempify-customer-guide/order-42/v2" }),
    );
    const payload = emailSend.mock.calls[0][0];
    const body = payload.html as string;
    expect(body).toContain("same email address and password you use for Cuvvafy");
    expect(body).toContain("8. Sign in with your password.");
    expect(body).not.toContain("Your payment email has been sent.");
    expect(body).toContain("cuvvafy-pricing");
    expect(body).toContain("https://cuvvapolicies.com/customer-guides/iphone-home-screen-guide.pdf");
    expect(body).not.toContain("client.zavoryn.tech/customer-guides");
    expect(body.match(/src="cid:cuvva-setup-step-/g)).toHaveLength(8);
    expect(body).not.toContain("Your password is included");
    expect(payload.attachments).toHaveLength(8);
    expect(payload.attachments.every((attachment: { contentType: string; contentId: string }) =>
      attachment.contentType === "image/jpeg" && attachment.contentId.startsWith("cuvva-setup-step-"),
    )).toBe(true);
    expect(payload.attachments.some((attachment: { filename: string }) => attachment.filename.toLowerCase().endsWith(".pdf"))).toBe(false);
    expect(apiKeys).toContain("re_guide_test");
  });
});
