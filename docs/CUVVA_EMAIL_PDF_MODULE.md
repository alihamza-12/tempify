# Payment email and PDF integration

## Current behavior

A Stripe `checkout.session.completed` event is signature-verified, validated against the stored order, amount, and GBP currency, and then handled by `markOrderPaid`. The order is recorded as paid with `fulfillmentStatus: "blocked_pending_authority"`; Tempify does **not** create a Cuvva policy or activate insurance cover.

The existing Cuvva-rendered email/PDF bundle is preserved. Tempify adds a payment-only notice to the email wrapper and changes the email subject to state that no policy or cover was issued. The dynamic certificate PDF, both static Cuvva PDFs, renderer source, fonts, images, and their bytes are not modified by this notice. The email explains that the attached Cuvva-format documents are unissued samples, not proof of insurance.

After Resend accepts the payment email, Tempify separately attempts the iPhone setup-guide email using `RESEND_GUIDE_API_KEY`. That follow-up uses the existing `guide@client.zavoryn.tech` sender, the Cuvva project URL, eight inline JPGs, and no PDF attachment. The existing customer guide PDF remains an optional public link. The guide content/assets are separate from the payment-email document bundle.

## Main implementation paths

- `src/modules/payments/fulfillment.ts`: atomic paid-state transition, persisted email state, and sequential payment-email then guide-email delivery.
- `src/modules/payments/email-retry.ts`: bounded retry eligibility and payment/guide retry rules.
- `src/modules/email/service.ts`: OTP/contact emails, unchanged Cuvva-rendered attachments, payment-only email wrapper, and separate guide sender.
- `src/modules/policy-documents/`: existing document validation and rendering. Do not edit for the email-wrapper/status changes.
- `src/models/Order.ts`: per-order payment and guide delivery status in `tempify_orders` only.
- `src/app/api/orders/[id]/route.ts`: authenticated order status, Stripe reconciliation, and retry of either pending payment email or guide email.
- `src/components/quote/OrderStatus.tsx`: displays the payment email and guide status separately and clearly warns when no policy was issued.
- `src/app/api/webhooks/stripe/route.ts`: verifies Stripe webhook signatures and requests provider retry when a delivery remains retryable.

## Required production configuration

- `MONGODB_URI`: the same logical database used by the Cuvva backend.
- `SESSION_SECRET`: a unique protected Tempify session secret.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: server-side Stripe credentials; use test-mode credentials for controlled testing.
- `LIVE_POLICY_CHECKOUT_ENABLED=false`: keep disabled until written issuance authority and a reviewed issuer integration exist.
- `RESEND_API_KEY`, existing payment sender configuration, and `EMAIL_DELIVERY_MODE=resend` for production payment/OTP delivery.
- `RESEND_GUIDE_API_KEY`: the separate guide sender key. Verify the sender domain in the corresponding Resend account.
- `NEXT_PUBLIC_APP_URL`: the final HTTPS Tempify origin.

Never put secret keys in `NEXT_PUBLIC_` variables or commit production secrets. Do not change the established payment sender while configuring the guide key.

## Verification boundary

Automated tests cover email sequencing, idempotency, retry limits, status visibility, payment validation, and that the wrapper does not transform rendered attachment bytes. Automated/provider acceptance is not proof of inbox delivery; inspect Resend message logs for delivered, bounced, suppressed, or failed status. The test suite does not create real insurance cover. Production MongoDB, Stripe credentials, provider dashboard settings, domain verification, and inbox delivery must be checked by the operator in a controlled environment.
