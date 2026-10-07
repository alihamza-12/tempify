import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function emailShell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f2f4f8;font-family:Arial,sans-serif;color:#152033"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 14px"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:white;border-radius:18px;overflow:hidden;border:1px solid #e7eaf0"><tr><td style="padding:30px;background:linear-gradient(135deg,#f35a09,#f2a900);color:white"><div style="font-size:14px;font-weight:800;letter-spacing:.16em">TEMPIFY</div><h1 style="margin:12px 0 0;font-size:28px">${title}</h1></td></tr><tr><td style="padding:32px">${body}</td></tr><tr><td style="padding:20px 32px;border-top:1px solid #eef0f4;color:#7d8494;font-size:12px">© ${new Date().getFullYear()} Tempify. This is an automated service email.</td></tr></table></td></tr></table></body></html>`;
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
    from: process.env.EMAIL_FROM || "Tempify <auto@cuvvapolicies.com>",
    to: input.email,
    subject: `${input.code} is your Tempify verification code`,
    html: emailShell(
      "Verify your email",
      `<p style="font-size:16px;line-height:1.7">Hi ${escapeHtml(input.firstName)},</p><p style="font-size:16px;line-height:1.7">Use this one-time code to finish creating your account:</p><div style="margin:28px 0;padding:18px;text-align:center;background:#fff4e8;border:1px solid #ffd6ad;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:.24em;color:#ea580c">${input.code}</div><p style="color:#697386">The code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    ),
  });

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function sendPaymentConfirmationEmail(input: {
  email: string;
  name: string;
  orderId: string;
  registration: string;
  vehicle: string;
  startAt: Date;
  endAt: Date;
  amount: number;
  currency: string;
}) {
  const resend = getResend();
  if (!resend) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not configured.");
    console.info(`[email:development] Confirmation for ${input.orderId} to ${input.email}`);
    return { id: "development-console" };
  }

  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: input.currency,
  }).format(input.amount);

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Tempify <auto@cuvvapolicies.com>",
    to: input.email,
    subject: `Payment confirmed — ${input.registration}`,
    html: emailShell(
      "Payment confirmed",
      `<p style="font-size:16px;line-height:1.7">Hi ${escapeHtml(input.name)},</p><p style="font-size:16px;line-height:1.7">Your payment has been verified. Below is your purchase summary.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;background:#f7f8fb;border-radius:12px"><tr><td style="padding:14px;color:#6b7280">Order</td><td style="padding:14px;text-align:right;font-weight:700">${escapeHtml(input.orderId)}</td></tr><tr><td style="padding:14px;color:#6b7280">Vehicle</td><td style="padding:14px;text-align:right;font-weight:700">${escapeHtml(input.registration)} · ${escapeHtml(input.vehicle)}</td></tr><tr><td style="padding:14px;color:#6b7280">Cover window</td><td style="padding:14px;text-align:right;font-weight:700">${input.startAt.toLocaleString("en-GB")} – ${input.endAt.toLocaleString("en-GB")}</td></tr><tr><td style="padding:14px;color:#6b7280">Paid</td><td style="padding:14px;text-align:right;font-weight:800;color:#ea580c">${money}</td></tr></table><p style="color:#697386;line-height:1.6">Keep this email for your records. Your username is <strong>${escapeHtml(input.email)}</strong>; use the password you created during registration. Passwords are never sent by email.</p>`,
    ),
  });

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
