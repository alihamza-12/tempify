import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canRetryGuideEmail, EMAIL_MAX_ATTEMPTS, EMAIL_RETRY_WINDOW_MS } from "./email-retry";

const now = Date.parse("2026-10-20T12:00:00.000Z");

beforeEach(() => vi.stubEnv("RESEND_GUIDE_API_KEY", "guide-test-key"));
afterEach(() => vi.unstubAllEnvs());

describe("guide email retry eligibility", () => {
  const eligibleOrder = {
    status: "paid",
    confirmationEmailStatus: "sent",
    guideEmailStatus: "failed",
    guideEmailAttempts: 1,
    guideEmailFirstAttemptAt: new Date(now - 60_000),
    guideEmailNextRetryAt: new Date(now + 60_000),
  };

  it("allows recovery within the bounded retry window, while the sender respects backoff", () => {
    expect(canRetryGuideEmail(eligibleOrder, now)).toBe(true);
  });

  it("waits for payment email acceptance", () => {
    expect(canRetryGuideEmail({ ...eligibleOrder, confirmationEmailStatus: "failed" }, now)).toBe(false);
  });

  it("does not retry a completed guide or exhausted attempts", () => {
    expect(canRetryGuideEmail({ ...eligibleOrder, guideEmailStatus: "sent" }, now)).toBe(false);
    expect(canRetryGuideEmail({ ...eligibleOrder, guideEmailAttempts: EMAIL_MAX_ATTEMPTS }, now)).toBe(false);
  });

  it("stops outside the provider idempotency safety window", () => {
    expect(canRetryGuideEmail({
      ...eligibleOrder,
      guideEmailFirstAttemptAt: new Date(now - EMAIL_RETRY_WINDOW_MS),
    }, now)).toBe(false);
  });

  it("does not report retries when the dedicated guide key is missing", () => {
    vi.stubEnv("RESEND_GUIDE_API_KEY", "");
    expect(canRetryGuideEmail(eligibleOrder, now)).toBe(false);
  });
});
