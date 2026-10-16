# Final payment audit — 15 October 2026

## Decision

**Local simulated flow passes; live end-to-end sign-off is still pending. Do not commit/deploy the previously applied ZIP as though this audit validated its runtime.** This archive contains additional fixes discovered by the audit. No commit or push was made.

The user confirmed applying `tempify-payment-email-updated-files.zip`, then specifically requested repeated sandbox checks and only the new/modified replacement files. **Use `tempify-payment-audit-only-changed-files.zip` over that already-applied archive.** It contains only files new or different since that archive, not the full repository or a cumulative patch for an untouched base. The broader audit-fix archive presented earlier is superseded for this request.

**Repeat verification:** the 14-scenario integration suite was run three more times in independent test processes with fresh isolated databases: **14/14, 14/14, 14/14 passed**. Then 74/74 unit tests, typecheck, lint, production build and zero-vulnerability production audit passed again. There are 88 distinct automated tests, not 116 distinct tests. No new defect appeared in these repetitions. This establishes repeatable simulated behavior, not real financial settlement.

## Problems reproduced and fixed

The initial integration run had seven failures: six genuine application defects and one incorrect test assertion (`contentType` versus Resend's serialized `content_type`). That assertion was corrected; it was NOT an application defect involving missing attachments.

| Reproduced behavior | Fix |
|---|---|
| Repeating checkout returned 404 instead of the existing payment link | Accept an owned in-progress quote and resume its saved unpaid checkout |
| Simultaneous checkout requests created two remote orders | Atomic draft-to-checkout claim before creating any local/remote order |
| Provider timeout deleted the local correlation record even if the provider had created an order | Preserve the local order as `review_required`; block blind recreation |
| An unexpected provider checkout destination was accepted | Validate response schema, exact identity/GBP amount/currency/status and HTTPS PayMeGate-hosted `/pay/{UUID}` URL |
| Manually forced PAID could be accepted during reconciliation | Reject forced status and require a settled transaction UUID |
| Signed PAID event without a settled transaction UUID was accepted | Require transaction evidence before marking paid/sending email |

Additional hardening: webhook header event ID must match the signed body ID; timestamp must be integer syntax before freshness/signature checks.

## Executed checks

- TypeScript: passed.
- ESLint: passed, including the new preflight script.
- Unit tests: **74 passed across 12 files**.
- Separate integration tests: **14 passed**, using an isolated real MongoDB 7.0.14 process, real routes/models/PDF generation and the actual Resend SDK; session authentication is mocked and provider/email HTTP traffic is intercepted.
- Total automated tests: **88 passed**.
- Production build: passed; 23 routes generated.
- `npm audit --omit=dev --audit-level=high`: zero reported production vulnerabilities. Installation reported five high development-dependency findings; no forced dependency update was applied.
- Preflight script: missing-key path executed (expected exit 1), plus a mocked three-GET merchant configuration check. No authenticated provider preflight has run.

### Integration coverage

1. Checkout → signed settled payment → three-PDF Cuvva-sender email, including after original quote deletion.
2. Three concurrent paid notifications submit one mocked email.
3. Wrong amount, stale signature and unsigned notifications leave the order unpaid.
4. Email provider failure preserves paid state; retry submits identical cached payload/idempotency key.
5. Repeated checkout resumes the existing link.
6. Concurrent checkout creates only one provider order.
7. Ambiguous creation timeout preserves the local record and prevents blind retry.
8. Unsafe provider checkout destination is rejected.
9. Forced PAID reconciliation is rejected.
10. Signed PAID without transaction evidence is rejected.
11. Another customer cannot read the order.
12. Disabled checkout gate creates no order/provider call.
13. Verified provider reconciliation sends the email when the webhook was missed.
14. Altering the header event ID without changing the signed body is rejected.

All customer identities and credentials used in these tests are synthetic. Test MongoDB is loopback-only and created/destroyed by the suite. No shared database or Cuvva service was accessed. This is not a browser E2E test or proof of real provider API compatibility.

## Apply and reproduce

Back up Tempify, merge the archive into its root, preserve real environment files, and do not put it in Cuvva. No database migration or shared-schema change is required. `checkoutCreationStatus` is a new Tempify Order field, not a new unique index. Old ambiguous/duplicate orders are not automatically repaired.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:payment:integration
npm run build
npm audit --omit=dev --audit-level=high
```

The integration suite may download a MongoDB binary on first run; it needs supported local OS libraries and permission to bind loopback. It never uses your actual MongoDB connection string. The live gate is true only inside the synthetic test process and restored afterward; no `.env` is modified.

## Remaining real test — do not skip

1. Identify where the new files are running and the exact URL. Verify the runtime was rebuilt/restarted from this patch, not a prior deployment. A source fingerprint alone does not prove the running build.
2. Run the read-only preflight privately on that host with its actual environment loaded. Example for a supported Node version, choosing the real filename rather than assuming this one exists:
   `node --env-file=.env.production.local scripts/payment-preflight.mjs`
   It reports configuration presence, partial source fingerprint, and merchant wallet/webhook/payment-method metadata. It prints no keys, signing secrets, wallet addresses, database URI or customer contacts. It does not alter merchant settings, create orders, query MongoDB or send email. Inspect the report; exit 0 alone is not a readiness verdict.
3. Confirm API endpoint compatibility. Current application default is `https://api.paymegate.com`; official OpenAPI lists `https://www.paymegate.com/api`. Do not assume either succeeds with the actual merchant account without a read-only authenticated check.
4. Keep `LIVE_POLICY_CHECKOUT_ENABLED=false` until written issuance authority and approved fulfillment exist. If authority is absent, any genuine payment test must be an isolated, explicitly disclosed non-insurance transaction, not public insurance checkout or an undisclosed gate bypass. No such live harness was created in this patch.
5. Before the user pays, agree the test amount/currency, actual method minimum, fees, destination asset/network and receiving wallet privately. The user executes the financial payment; do not ask for card details, private keys or credentials in chat.
6. Capture sanitized evidence of provider-settled transaction identity, matched local paid state, successful webhook HTTP 200 (or verified reconciliation), one submitted email, actual inbox receipt, three readable customer-specific sample-labelled PDFs, and final wallet credit on the expected network net of applicable fees.
7. Record each result independently. A dashboard-forced PAID state is not a financial test; Resend acceptance is not inbox receipt; PAID is not independent wallet-settlement evidence.

## Limits / operational follow-up

- An ambiguous provider creation needs manual reconciliation using the saved external ID; do not delete the local order or reset its quote and retry blindly. Provider external IDs are not guaranteed unique. A crash between quote claim and local-order save can leave a quote locked for review.
- There is no background mail worker: webhook retries or the authenticated status page trigger retry. Existing five-attempt/23-hour bounds remain; inspect provider delivery before manual resend. No indefinite exactly-once guarantee.
- This audit did not check browser UX, real authentication, deployed secrets, live provider checkout methods, sender authorization, bounces, inbox receipt or wallet credit.
- API refund recording does not itself move money. Do not promise an automatic refund for this test.
- Sample labels and the existing checkout gate remain. No policy is issued by these PDFs. OTP/contact branding, Cuvva source/assets and shared schemas were not changed by this audit.
- No deployment, commit, push, authenticated live API request, real order/payment or external email was performed.

## Contracts consulted

- PayMeGate developer API: https://www.paymegate.com/developers/api
- PayMeGate OpenAPI: https://api.paymegate.com/openapi/public-v1.json
- Resend idempotency: https://resend.com/docs/dashboard/emails/idempotency-keys
