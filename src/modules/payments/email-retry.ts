export const EMAIL_LEASE_MS = 5 * 60_000;
export const EMAIL_RETRY_DELAY_MS = 60_000;
export const EMAIL_MAX_ATTEMPTS = 5;
// Resend retains idempotency keys for 24h. Stop automatic recovery at 23h.
export const EMAIL_RETRY_WINDOW_MS = 23 * 60 * 60_000;

type EmailState = {
  confirmationEmailStatus?: string;
  confirmationEmailAttempts?: number;
  confirmationEmailFirstAttemptAt?: Date | string | null;
};

type GuideEmailState = {
  status?: string;
  confirmationEmailStatus?: string;
  guideEmailStatus?: string;
  guideEmailAttempts?: number;
  guideEmailFirstAttemptAt?: Date | string | null;
  guideEmailNextRetryAt?: Date | string | null;
  guideEmailClaimedAt?: Date | string | null;
};

export function canRetryPaymentEmail(order: EmailState, now = Date.now()) {
  if (order.confirmationEmailStatus === "sent" || (order.confirmationEmailAttempts || 0) >= EMAIL_MAX_ATTEMPTS) return false;
  if (order.confirmationEmailStatus === "sending" && !order.confirmationEmailFirstAttemptAt) return false;
  if (order.confirmationEmailFirstAttemptAt) {
    const start = new Date(order.confirmationEmailFirstAttemptAt).getTime();
    if (!Number.isFinite(start) || start > now || now - start >= EMAIL_RETRY_WINDOW_MS) return false;
  }
  return true;
}

/** Retry the guide independently, but only after the payment email is accepted. */
export function canRetryGuideEmail(order: GuideEmailState, now = Date.now()) {
  if (!process.env.RESEND_GUIDE_API_KEY || order.status !== "paid" || order.confirmationEmailStatus !== "sent") return false;
  if (order.guideEmailStatus === "sent" || (order.guideEmailAttempts || 0) >= EMAIL_MAX_ATTEMPTS) return false;
  // Active claims are safe to poll: sendGuideFollowupEmail uses an atomic
  // five-minute lease, so duplicate status checks cannot send a second message.
  if (order.guideEmailFirstAttemptAt) {
    const start = new Date(order.guideEmailFirstAttemptAt).getTime();
    if (!Number.isFinite(start) || start > now || now - start >= EMAIL_RETRY_WINDOW_MS) return false;
  }
  return true;
}
