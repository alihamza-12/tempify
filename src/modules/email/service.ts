import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Resend } from "resend";
import { buildSamplePolicyBundle } from "@/modules/policy-documents/sample";
import { policyDocumentSchema } from "@/modules/policy-documents/schema";
import { gbpPence } from "@/modules/payments/validation";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function emailShell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f2f4f8;font-family:Arial,sans-serif;color:#152033"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 14px"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:white;border-radius:18px;overflow:hidden;border:1px solid #e7eaf0"><tr><td style="padding:30px;background:linear-gradient(135deg,#5e4bff,#8b5cf6);color:white"><div style="font-size:14px;font-weight:800;letter-spacing:.16em">CUVVAFY</div><h1 style="margin:12px 0 0;font-size:28px">${title}</h1></td></tr><tr><td style="padding:32px">${body}</td></tr><tr><td style="padding:20px 32px;border-top:1px solid #eef0f4;color:#7d8494;font-size:12px">© ${new Date().getFullYear()} Cuvvafy. This is an automated service email.</td></tr></table></td></tr></table></body></html>`;
}

export async function sendVerificationEmail(input: {
  email: string;
  firstName: string;
  code: string;
}) {
  const resend = getResend();
  const deliveryMode = process.env.EMAIL_DELIVERY_MODE || "resend";

  if (!resend || deliveryMode === "console") {
    if (process.env.NODE_ENV === "production" && deliveryMode !== "console") {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    console.info(`[email:development] OTP for ${input.email}: ${input.code}`);
    return { id: "development-console" };
  }

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Cuvvafy <auto@cuvvapolicies.com>",
    to: input.email,
    subject: `${input.code} is your Cuvvafy verification code`,
    html: emailShell(
      "Verify your email",
      `<p style="font-size:16px;line-height:1.7">Hi ${escapeHtml(input.firstName)},</p><p style="font-size:16px;line-height:1.7">Use this one-time code to finish creating your account:</p><div style="margin:28px 0;padding:18px;text-align:center;background:#f0eaff;border:1px solid #c4b5fd;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:.24em;color:#6d28d9">${input.code}</div><p style="color:#697386">The code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    ),
  });

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export type PreparedPaymentEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments: { filename: string; content: string; contentType: string; contentId?: string }[];
};

export async function preparePaymentDocumentEmail(input: {
  orderId: string; email: string; amount: number; currency: string; documentSnapshot: unknown;
}): Promise<PreparedPaymentEmail> {
  const document = policyDocumentSchema.parse(input.documentSnapshot);
  if (document.policy._id !== input.orderId ||
      document.customer.email.toLowerCase() !== input.email.toLowerCase() ||
      input.currency !== "GBP" || gbpPence(input.amount) === null ||
      gbpPence(document.policy.premiumAmount) !== gbpPence(input.amount)) {
    throw new Error("Document snapshot does not match the verified order.");
  }
  const bundle = await buildSamplePolicyBundle(document, true);
  const from = process.env.PAYMENT_EMAIL_FROM || "Cuvva <auto@cuvvapolicies.com>";
  if (/[\r\n]/.test(from)) throw new Error("Invalid payment email sender.");
  return {
    from, to: bundle.to, subject: bundle.subject, html: bundle.html,
    attachments: bundle.attachments.map((attachment) => ({
      filename: attachment.filename, content: attachment.content.toString("base64"),
      contentType: attachment.contentType,
      ...(attachment.cid ? { contentId: attachment.cid } : {}),
    })),
  };
}

/**
 * Send the second, inline iPhone setup guide after the original Cuvva payment
 * email has been accepted. The PDF is not attached; the eight JPGs are inline
 * CID images so the complete instructions appear in the email body.
 */
export async function sendCustomerGuideEmail(input: {
  orderId: string;
  email: string;
  firstName?: string;
}) {
  const key = process.env.RESEND_GUIDE_API_KEY;
  if (!key) throw new Error("RESEND_GUIDE_API_KEY is not configured.");
  const resend = new Resend(key);
  const projectUrl = "https://cuvvapolicies.com/admin/dashboard?tab=cuvvafy-pricing";
  const visibleProjectUrl = "https://cuvvapolicies.com";
  const guidePdfUrl = `${visibleProjectUrl}/customer-guides/iphone-home-screen-guide.pdf`;
  const greeting = input.firstName?.trim() ? escapeHtml(input.firstName.trim()) : "there";
  const steps = [
    { title: "Open your Cuvva project link", text: "Open the Cuvva project link on your iPhone in Safari. When the welcome screen appears, tap Safari’s three-dot menu at the bottom right.", image: "step-01-safari-menu.jpg", alt: "Safari with the Cuvva project login page open and its menu highlighted" },
    { title: "Choose Share", text: "In Safari’s menu, tap Share to open the iPhone sharing options. The Share control is highlighted in red.", image: "step-02-share.jpg", alt: "Safari Share action highlighted" },
    { title: "Show more actions", text: "If the full list of actions is not shown, tap View More (the down chevron) to expand it. Some iOS versions show the full list automatically.", image: "step-03-view-more.jpg", alt: "View More action highlighted in the iPhone share sheet" },
    { title: "Add it to your Home Screen", text: "Scroll the expanded actions if needed, then tap Add to Home Screen. This creates an app-style shortcut on your iPhone.", image: "step-04-add-home.jpg", alt: "Add to Home Screen action highlighted" },
    { title: "Confirm and tap Add", text: "Check the address is cuvvapolicies.com. Leave Open as Web App enabled, then tap Add. The shortcut name can remain “Cuvva”.", image: "step-05-confirm-add.jpg", alt: "Add to Home Screen dialog with the Cuvva project domain and Add button highlighted" },
    { title: "Open the new shortcut", text: "Return to your Home Screen and tap the new Cuvva icon. If you do not see it, swipe to another Home Screen page.", image: "step-06-open-icon.jpg", alt: "Cuvva shortcut highlighted on the iPhone Home Screen" },
    { title: "Enter your account email", text: "Enter the same email address you use to sign in to Cuvvafy, then tap Continue. Use your own account email, not the placeholder shown.", image: "step-07-email.jpg", alt: "Welcome screen with the email field highlighted" },
    { title: "Sign in with your password", text: "Enter the same password you use for Cuvvafy, then tap Sign in with email. If sign-in fails, use the site’s recovery option or contact support.", image: "step-08-password.jpg", alt: "Password screen with the password field highlighted" },
  ];
  const attachments = await Promise.all(steps.map(async (step, index) => ({
    filename: step.image,
    content: (await readFile(join(process.cwd(), "public/customer-guides/assets", step.image))).toString("base64"),
    contentType: "image/jpeg",
    contentId: `cuvva-setup-step-${String(index + 1).padStart(2, "0")}`,
  })));
  const stepsHtml = steps.map((step, index) => {
    const contentId = `cuvva-setup-step-${String(index + 1).padStart(2, "0")}`;
    return `<p style="margin:22px 0 8px;font-size:15px;line-height:1.7;color:#343c4e"><strong>${index + 1}. ${step.title}.</strong> ${step.text}</p><p style="margin:0 0 22px"><img src="cid:${contentId}" alt="${step.alt}" width="520" style="display:block;width:100%;max-width:520px;height:auto;margin:0 auto;border:1px solid #e4e5ed;border-radius:8px"></p>`;
  }).join("");
  const html = emailShell(
    "Your Cuvva project setup guide",
    `<p style="font-size:16px;line-height:1.7">Hi ${greeting},</p><p style="font-size:16px;line-height:1.7">Open the Cuvva project pricing dashboard on your iPhone: <a href="${projectUrl}" style="color:#6547ed;font-weight:700">${visibleProjectUrl}</a></p><p style="font-size:16px;line-height:1.7">To add it to your iPhone Home Screen, open the link in Safari and follow these steps:</p>${stepsHtml}<p style="font-size:15px;line-height:1.7"><strong>Sign in:</strong> Use the same email address and password you use for Cuvvafy. Your password is not included here. Never send it by email or text; enter it only on the official Cuvva project page at <a href="${projectUrl}" style="color:#6547ed">${visibleProjectUrl}</a>.</p><p style="font-size:14px;line-height:1.6">Prefer a PDF copy? <a href="${guidePdfUrl}" style="color:#6547ed;font-weight:700">View or download the iPhone setup guide</a>.</p>`,
  );
  const result = await resend.emails.send({
    from: "Cuvvafy Guide <guide@client.zavoryn.tech>",
    to: input.email,
    subject: "Your Cuvva project access and iPhone setup",
    html,
    attachments,
  }, {
    idempotencyKey: `tempify-customer-guide/${input.orderId}/v2`,
    signal: AbortSignal.timeout(20_000),
  });
  if (result.error) throw new Error("Customer guide email was rejected by the email provider.");
  if (!result.data?.id) throw new Error("Email provider did not confirm the guide email.");
  return result.data;
}

/** Called only by verified-paid order fulfillment, with a persisted exact payload. */
export async function sendPaymentConfirmationEmail(input: { orderId: string; payload: PreparedPaymentEmail }) {
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY is not configured.");
  if ((process.env.EMAIL_DELIVERY_MODE || "resend") !== "resend") {
    throw new Error("Email delivery is disabled by EMAIL_DELIVERY_MODE.");
  }
  const result = await resend.emails.send(input.payload, {
    idempotencyKey: `tempify-payment-documents/${input.orderId}/v1`,
    signal: AbortSignal.timeout(20_000),
  });
  if (result.error) throw new Error("Payment document email was rejected by the email provider.");
  if (!result.data?.id) throw new Error("Email provider did not confirm acceptance.");
  return result.data;
}

type ContactEmailInput = {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
};

/**
 * Build both sides of the contact exchange. The support copy keeps the
 * customer's address as Reply-To, while the customer receives an explicit
 * acknowledgement that does not expose the private support destination.
 */
export function buildContactEmailBatch(input: ContactEmailInput) {
  const from = process.env.EMAIL_FROM || "Cuvvafy <auto@cuvvapolicies.com>";
  const supportTo = process.env.CONTACT_TO_EMAIL || "support@cuvvapolicies.com";
  const cleanSubject = input.subject.replace(/[\r\n]+/g, " ").trim();
  const safeSubject = escapeHtml(cleanSubject);
  const safeFirstName = escapeHtml(input.firstName);
  const safeFullName = `${safeFirstName} ${escapeHtml(input.lastName)}`;
  const safeEmail = escapeHtml(input.email);
  const safeMessage = escapeHtml(input.message).replace(/\r?\n/g, "<br>");

  return [
    {
      from,
      to: [supportTo],
      replyTo: input.email,
      subject: `[Cuvvafy support] ${cleanSubject}`,
      html: emailShell(
        "New support request",
        `<p style="font-size:16px;line-height:1.7"><strong>From:</strong> ${safeFullName} (${safeEmail})</p><p style="font-size:16px;line-height:1.7"><strong>Subject:</strong> ${safeSubject}</p><div style="margin-top:22px;padding:18px;background:#f7f8fb;border-radius:12px;font-size:15px;line-height:1.7">${safeMessage}</div>`,
      ),
    },
    {
      from,
      to: [input.email],
      subject: "We received your Cuvvafy message",
      html: emailShell(
        "We received your message",
        `<p style="font-size:16px;line-height:1.7">Hi ${safeFirstName},</p><p style="font-size:16px;line-height:1.7">Thanks for contacting Cuvvafy. We received your message about <strong>${safeSubject}</strong> and aim to respond within 24 hours.</p><p style="color:#697386;line-height:1.6">This acknowledgement confirms receipt of your enquiry only. It does not create a payment, insurance policy or insurance cover.</p>`,
      ),
    },
  ];
}

export async function sendContactMessageEmails(input: ContactEmailInput) {
  const resend = getResend();
  const deliveryMode = process.env.EMAIL_DELIVERY_MODE || "resend";
  const cleanSubject = input.subject.replace(/[\r\n]+/g, " ").trim();

  if (!resend || deliveryMode === "console") {
    if (process.env.NODE_ENV === "production" && deliveryMode !== "console") {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    console.info("[email:development] Contact message and customer acknowledgement", {
      from: input.email,
      subject: cleanSubject,
    });
    return { id: "development-console" };
  }

  const result = await resend.batch.send(buildContactEmailBatch(input));
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#039;",
      '"': "&quot;",
    };
    return map[character];
  });
}
