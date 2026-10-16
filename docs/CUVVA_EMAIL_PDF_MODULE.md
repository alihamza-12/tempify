> **15 October 2026 update:** The newer `tempify-payment-audit-only-changed-files.zip` adds only the changed/new paths over the previously applied delivery ZIP. Additional checkout/settled-payment checks and 14 real-MongoDB integration tests now pass (88 total tests). See `PAYMENT_FINAL_AUDIT.md`; live payment, inbox receipt and wallet settlement remain unverified.

# Direct payment-to-email implementation

The customer flow is connected in code: a signed, matched paid webhook or provider reconciliation calls `markOrderPaid`, which calls `sendPaidOrderEmail`. It builds the original Cuvva-template email with the dynamic PDF and both other PDFs, labels all three as samples, and sends through the existing Resend API with the configured Cuvva sender. There is no separate policy-document delivery enable setting and no insurer adapter dependency for these sample emails.

Read `docs/REPLACE_FILES_GUIDE.md` for the current installation instructions and complete scope. Earlier descriptions of an unconnected sender or an extra policy-email switch no longer describe this version.

## Main files

- `src/modules/payments/fulfillment.ts`: atomic paid-state transition, per-order email claim, payload persistence and delivery/retry.
- `src/modules/payments/email-retry.ts`: bounded retry/lease rules, with no extra environment configuration.
- `src/modules/email/service.ts`: original Tempify OTP/contact functions plus preparation and sending of the paid sample-document email.
- `src/modules/policy-documents/from-quote.ts`: customer-specific immutable sample rendering snapshot saved before checkout.
- `src/modules/policy-documents/bundle.ts`: original source renderer, static PDFs and CID assets.
- `src/modules/policy-documents/sample.ts`: small footer on EVERY PDF and clear sample notice in email; used by both payment delivery and offline previews.
- `src/models/Order.ts`: adds snapshot/email-delivery metadata only to the existing Tempify order collection. Cuvva collections/schemas are not changed.
- `src/app/api/orders/[id]/route.ts`: persisted payment status and bounded email retries for the signed-in order owner.
- `src/app/api/webhooks/paymegate/route.ts`: verifies signatures/fields, invokes fulfillment and signals retryable email failure to the provider.
- `vendor/cuvva/`: unchanged original template source, images/fonts and PDFs; SHA-256 manifest records source backend revision `fe51b0979ca8b94d3552792305e57955bf9dd5f0`.

## Source matching and deliberate distinctions

The base card-payment HTML matches the original builder for identical ordinary input. Fixed-time dynamic PDF tests match direct original-source generation byte-for-byte under PDFKit 0.19.1. The original static PDF bytes and asset hashes match their source.

Outgoing sample PDFs add only the small sample footer and sample metadata. The email has a prominent sample notice and subject, does not promise document availability in the Cuvva app, escapes customer-controlled text, and uses Paid via PayMeGate rather than inventing card details. Its layout/assets still come from the original Cuvva builder. The sample certificate is Wakam-specific because the source template hardcodes that insurer; this does not establish an insurer relationship or cover.

No real policy reference is invented: dynamic sample references start with SAMPLE-. No record is inserted into the shared policies collection. Existing live checkout activation stays unchanged and disabled by default. The code and mocks pass locally; production credentials, actual provider settlement, live MongoDB behavior and inbox delivery still require a controlled deployment test. No deployment or external transaction was performed here.
