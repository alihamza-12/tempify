# Tempify setup and delivery operations

This document describes the current Tempify source tree. It is not a patch ZIP and does not instruct you to overwrite your project with an older archive.

## Local setup

1. Use Node.js 20.19+, 22.13+, or 24+ and a MongoDB test/staging database.
2. In the Tempify root, install dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` (Git-ignored) and replace placeholders with local/test values only.
4. For the email/payment flow, use `EMAIL_DELIVERY_MODE=resend`, test Stripe keys, the Stripe CLI webhook secret, and `STRIPE_TEST_ALLOWED_EMAILS` containing only inboxes you control. The Resend messages are real emails.
5. Use an HTTPS tunnel for the local app origin; Stripe redirects use HTTPS in this build. Follow [LOCAL_AND_PREVIEW_TESTING.md](LOCAL_AND_PREVIEW_TESTING.md) for exact commands and the separate Vercel Preview setup.

Never use production MongoDB or live Stripe keys for test checkout. Do not paste secrets into chat, commit them, or place them in a `NEXT_PUBLIC_` variable.

## Shared customer accounts

Tempify OTP registration creates a `Customer` record in the `users` collection with a bcrypt password hash. Cuvva backend login checks that same password format. For cross-project credentials to work, Tempify and Cuvva must use the same MongoDB database. Each app issues its own session cookie, so a customer signs into each site separately.

Customer profile details are saved to the shared user record during the quote/profile flow. Tempify's vehicle lookup requires `REGCHECK_USERNAMES`, a valid `SHARED_INTEGRATION_OWNER_ID`, and the same shared database. The configured integration owner must be an active Cuvva Super Admin.

## Stripe checkout and the policy gate

The active checkout uses Stripe and the webhook endpoint is:

```text
https://YOUR-TEMPIFY-DOMAIN/api/webhooks/stripe
```

Subscribe to `checkout.session.completed` and configure the webhook signing secret as `STRIPE_WEBHOOK_SECRET`. Use Stripe test-mode credentials for controlled payment-path verification.

This build supports allowlisted Stripe **test-mode** checkout only. A deployed Preview environment additionally requires `STRIPE_TEST_CHECKOUT_ENABLED=true`; live Stripe keys are rejected regardless of `LIVE_POLICY_CHECKOUT_ENABLED`. Keep `LIVE_POLICY_CHECKOUT_ENABLED=false`. A paid test order is not a Cuvva policy: fulfilment sets `blocked_pending_authority` and does not write to `policies`. Do not represent payment as proof of insurance or cover.

The previous PayMeGate implementation/documentation is legacy compatibility material. Do not configure PayMeGate expecting it to drive the current Stripe checkout.

## Payment and guide email delivery

The payment email is submitted first with the existing `PAYMENT_EMAIL_FROM` and `RESEND_API_KEY` configuration. It receives a clear payment-only notice stating that no policy or cover was issued. Existing dynamic and static Cuvva PDF attachment bytes are preserved unchanged.

Set `EMAIL_DELIVERY_MODE=resend` for explicit email-based OTP and payment delivery (the legacy console value also routes through Resend when configured; OTPs are never returned or logged). The setup guide is a separate follow-up and is attempted only after the payment email is accepted by Resend. Configure `RESEND_GUIDE_API_KEY` separately; the guide sender domain must be verified in the associated Resend account. Test-mode payments send real email, so restrict checkout with `STRIPE_TEST_ALLOWED_EMAILS` to inboxes you control. The guide email contains eight inline JPG illustrations and does not attach a PDF. Its public iPhone guide PDF link and guide source/assets remain unchanged.

The authenticated order-status page displays payment-email and guide-email outcomes separately. “Submitted” means Resend accepted the request, not that it reached the inbox. Verify actual delivery using the Resend dashboard, including suppression, bounce, and delivery status. Guide retries use an idempotency key and are bounded; exhausted or stale orders need support review rather than an untracked manual resend.

## Checks before a deliberate production deployment

Run these commands in the Tempify root:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:payment:integration
npm run build
npm audit --omit=dev
```

The integration suite uses a temporary MongoDB instance and mocked Stripe/Resend traffic. It does not take real payments, send real mail, or issue policies. After a successful local run, production-only verification still requires checking the protected environment variables, Stripe webhook delivery, Resend message logs, the shared database URI, the Cuvva API/frontend URLs, and the final deployed build. Do not enable live collection merely because automated tests pass.
