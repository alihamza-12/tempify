import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { batchSend } = vi.hoisted(() => ({
  batchSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    batch = { send: batchSend };
  },
}));

import {
  buildContactEmailBatch,
  sendContactMessageEmails,
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
    process.env.EMAIL_FROM = "Tempify <auto@cuvvapolicies.com>";
    process.env.CONTACT_TO_EMAIL = "support@example.com";
    batchSend.mockReset();
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_DELIVERY_MODE;
    delete process.env.EMAIL_FROM;
    delete process.env.CONTACT_TO_EMAIL;
  });

  it("builds a support notification and a separate customer acknowledgement", () => {
    const emails = buildContactEmailBatch(input);

    expect(emails).toHaveLength(2);
    expect(emails[0]).toMatchObject({
      to: ["support@example.com"],
      replyTo: "ava@example.com",
      subject: "[Tempify support] Quote <question>",
    });
    expect(emails[1]).toMatchObject({
      to: ["ava@example.com"],
      subject: "We received your Tempify message",
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
});
