# Apply this ZIP — final payment-audit fixes

You confirmed applying `tempify-payment-email-updated-files.zip`. This newer **`tempify-payment-audit-only-changed-files.zip` contains only files changed or added since that applied archive**. It is not the whole repository and is not sufficient for an untouched checkout of the original base. Merge it over your already-updated Tempify project; do not apply old ZIPs afterward. Read `docs/PAYMENT_FINAL_AUDIT.md` before committing.

The 14 payment integration scenarios passed three further independent sandbox runs. All 74 unit tests, typecheck, lint, production build and production dependency audit then passed again. No real charge, provider email or wallet transfer was made.

**Update 15 Oct 2026 — CI type-check:** If you saw `TS2307`/`TS7006` in GitHub Actions, apply the CI fix ZIP: it changes route imports to relative paths (`../../app/api/...`) and keeps `baseUrl` in `tsconfig.json`. Then run `npm ci && npm run typecheck`.

## What happens now

1. PayMeGate confirms payment through a verified webhook, or the server checks the provider's order status.
2. Tempify checks matching local/provider order IDs, exact GBP amount and currency, and a settled transaction UUID; manually forced PAID is not accepted.
3. It marks the order paid and immediately prepares the Cuvva-template email.
4. It sends from `PAYMENT_EMAIL_FROM` (default `Cuvva <auto@cuvvapolicies.com>`) through your existing Resend account.
5. The email contains these three PDFs:
   - Policy details and certificate.pdf — filled dynamically from this customer's saved order details.
   - Policy wording (full terms).pdf.
   - Insurance summary (IPID).pdf.

There is **no `POLICY_DOCUMENT_DELIVERY_ENABLED` switch** in application code or the environment template. No portfolio-test variables or separate issuer adapter are required for this sample-document email flow.

The original Cuvva layout/assets are reused, and the email continues to identify the documents as samples. No valid insurance policy is created; customer data is escaped and unknown card details are not invented.

## Install

1. Back up your local Tempify project and stop its development server.
2. Extract the ZIP into the **Tempify root**, where `package.json` is located.
3. Merge folders and replace matching files. Do NOT delete the entire `src` folder.
4. Preserve real `.env` files. `.env.example` is only a template; do not replace your actual credentials with it.
5. Do not put these files in your separate Cuvva project.
6. Run in the Tempify root:

```bash
npm ci
npm run dev
```

For a local email/PDF preview without taking payment or sending mail:

```bash
npm run preview:policy
```

Open `previews/cuvva-policy/email-preview.html`. All PDFs and the unsent `.eml` message are in the same folder.

## Existing email settings

Use the existing valid `RESEND_API_KEY`, verified sender/domain and `EMAIL_DELIVERY_MODE=resend` to actually send emails. `PAYMENT_EMAIL_FROM` still controls the Cuvva sender; OTP/contact emails keep their existing Tempify sender. No new secret is required.

If you manually added `POLICY_DOCUMENT_DELIVERY_ENABLED`, `PORTFOLIO_PAYMENT_TEST_ENABLED`, or `PORTFOLIO_PAYMENT_TEST_EMAILS` to your local environment, you can delete those lines. This application does not read them. Restart the process after changing an environment file. Never paste secret values into chat.

## Checkout setting is unchanged

This update does not enable customer checkout. The existing `LIVE_POLICY_CHECKOUT_ENABLED=false` gate remains unchanged, and with it false the Pay button cannot create a new live payment order. The email flow is wired to verified paid orders; removing the extra email switch is not a bypass of checkout controls.

Do not sell these sample PDFs as real cover or enable real insurance checkout on the assumption that payment creates a policy. No provider charge, real email, policy issuance or production deployment was performed while preparing this ZIP.

## Reliability built into the flow

- Repeat checkout resumes an existing unpaid link; an atomic quote claim prevents simultaneous duplicate order creation.
- Ambiguous provider failures preserve the local order for manual reconciliation and block blind recreation.
- Provider responses/checkout destinations are validated; signed event identity must match the notification header.

- A server-side document snapshot is saved on the new order before creating its PayMeGate checkout. Expiry/deletion of the quote no longer loses the details needed for the PDFs.
- Atomic paid-state updates and an email claim prevent normal concurrent/duplicate notifications from sending multiple emails.
- The exact generated email payload is saved in the order. Retries use the same bytes and Resend idempotency key.
- Failed email does not turn a successful payment into a failed payment or invite a second charge.
- Retries are triggered by provider webhook retries or the signed-in order-status page: 60-second backoff, five attempts maximum, stale claim recovery after five minutes, and a 23-hour recovery window. This is not a separate background email worker. After the retry limit/window, support must review delivery before any manual resend.
- A webhook can return HTTP 503 after recording payment if email delivery needs retry. This does not mean the customer's payment failed.
- API/provider acceptance is displayed as submitted, not guaranteed inbox delivery. Bounces/spam placement are not tracked in this patch.
- Previously completed receipt emails are not automatically resent as new sample-document emails. Old orders with no saved snapshot and an expired quote require manual review.

Resend documents a 24-hour idempotency window: https://resend.com/docs/dashboard/emails/idempotency-keys . The shorter local window avoids automatic resends after that protection expires.

## Verification performed

- TypeScript and ESLint: passed.
- Tests: **88 passed: 74 unit tests across 12 files plus 14 isolated real-MongoDB integration tests**.
- Production build: passed.
- Production dependency audit: zero reported vulnerabilities. Five existing high-severity development-lint findings remain; no forced fix was applied.
- Real PDF rendering and email-payload construction were exercised through the paid-order path. Integration tests use isolated real MongoDB, mocked session authentication and intercepted PayMeGate/Resend HTTP traffic; no live financial/email transaction was performed.
- Tests cover invalid/mismatched payments, concurrent/duplicate notifications, exact-payload retries, recovery, missing quote data, console mode and customer-specific quote mapping.
- Compiled production webhook was imported and rejected an unsigned request with HTTP 401.

`CHANGED_FILES.txt` lists every included application file. `FILE_HASHES.sha256` provides integrity hashes. Your original Cuvva project is unchanged. Review local changes before copying if your local repository differs from the published base revision.

Pushing to your configured main branch triggers existing CI/CD. This ZIP has not been pushed or deployed. Apply and verify locally before deliberately deploying.
