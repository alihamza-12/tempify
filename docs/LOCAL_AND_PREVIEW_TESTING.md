# Local and deployed test-mode setup

This source tree supports **Stripe test-mode checkout only**. It does not issue a Cuvva policy or activate cover. Live Stripe keys are deliberately rejected by the checkout route until an authorised policy-issuance integration exists. Keep `LIVE_POLICY_CHECKOUT_ENABLED=false`; setting it to `true` does not bypass the test-only safety check.

## Never mix environment credentials

The environment values supplied in chat contained conflicting Stripe modes. Do not put live and test values in the same `.env` file or Vercel environment. A dotenv file with duplicate names can silently use the later value. The Stripe secret and publishable key must both be test keys (`sk_test_…` and `pk_test_…`) or both be live keys (`sk_live_…` and `pk_live_…`); this application rejects a detected mismatch.

- **Local development:** use a local/staging MongoDB database, Stripe test secret, matching test publishable key, Stripe CLI test webhook secret, and test inboxes you control.
- **Deployed test:** use a Vercel **Preview** deployment (or another isolated staging deployment) with its own test-mode environment variables. Set `STRIPE_TEST_CHECKOUT_ENABLED=true` only in that test environment. Never put test keys in Production variables.
- **Production:** keep the production Stripe keys isolated and `LIVE_POLICY_CHECKOUT_ENABLED=false`. This build intentionally will not accept live payments because it has no authorised policy issuer. Do not enable real charges until that separate requirement is met.

Do not paste secrets in chat, commit them, include them in a ZIP, or expose secret keys through `NEXT_PUBLIC_` variables. If any key pasted into chat was real rather than masked, rotate it in the provider dashboard.

## Local test-mode steps

1. Use a **test/staging MongoDB database**, not the live Cuvva production database. Copy `.env.example` to `.env.local` (this file is Git-ignored) and set the test database URI, shared-integration owner for that test database, a fresh session secret, and the actual test email/API values. Do not copy the values from the production environment into `.env.local`.
2. Set `EMAIL_DELIVERY_MODE=resend`. This sends the OTP by email and prevents the development OTP from being returned to the browser or printed to the console. Resend has no general-purpose fake delivery mode: use an inbox you control. Configure both `RESEND_API_KEY` and `RESEND_GUIDE_API_KEY`; they may be different keys but must authorize their respective verified senders.
3. Set `STRIPE_SECRET_KEY` to one Stripe **test** secret (`sk_test_…`), both configured publishable-key variables to the matching **test** publishable key (`pk_test_…`), `LIVE_POLICY_CHECKOUT_ENABLED=false`, and `STRIPE_TEST_ALLOWED_EMAILS` to the comma-separated test inbox addresses you control. For a local `npm run dev` process, test mode is permitted without a deployed override. Checkout still requires the signed-in account email to be on the allowlist.
4. Start the app and an HTTPS tunnel to it. Stripe Checkout redirects require an HTTPS application origin in this project:

   ```bash
   npm run dev -- --hostname 0.0.0.0
   cloudflared tunnel --url http://localhost:3000
   ```

   Put the tunnel's HTTPS origin in `NEXT_PUBLIC_APP_URL`, restart the app, and keep the tunnel alive during the test. A stable HTTPS ngrok/Cloudflare tunnel can be used instead. Do not use `http://localhost:3000` for `NEXT_PUBLIC_APP_URL`.
5. In another terminal, install and run Stripe CLI in test mode, forwarding signed test events to the local app:

   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   Copy the `whsec_…` value printed by Stripe CLI into local `STRIPE_WEBHOOK_SECRET`, then restart the app. This local signing secret is not the deployed Stripe webhook secret.
6. Register/sign in with an allowlisted test inbox, make a quote, and complete Stripe Checkout using a Stripe test card from the Stripe documentation. Use a test expiry date, CVC, and postal code accepted by Stripe. Do not enter real card details.
7. On verified test payment, the app submits the payment confirmation email first; only after provider acceptance it submits the separate setup-guide email. The two Resend messages are real outbound emails to the allowlisted address, not simulated emails. The guide uses inline images and no PDF attachment. The order page reports provider acceptance, not inbox delivery; check Resend logs for actual delivery/bounce/suppression.

## Deployed test-mode steps

For Vercel, add test values to the **Preview** environment only, then deploy a Preview build. Use a stable HTTPS preview/test hostname as `NEXT_PUBLIC_APP_URL`, a Stripe test-mode webhook endpoint at `https://YOUR-PREVIEW-HOST/api/webhooks/stripe`, and the matching `whsec_…` from Stripe's **test-mode** webhook configuration. Set:

```dotenv
EMAIL_DELIVERY_MODE=resend
LIVE_POLICY_CHECKOUT_ENABLED=false
STRIPE_TEST_CHECKOUT_ENABLED=true
STRIPE_SECRET_KEY=sk_test_…
STRIPE_PUBLISHABLE_KEY=pk_test_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_TEST_ALLOWED_EMAILS=your-test-inbox@example.com
```

Also configure the Preview environment's test/staging MongoDB URI, `SESSION_SECRET`, Resend keys/senders, and other required server-side integrations. Do not use the production database or production Stripe keys for a Preview test. Make sure the selected preview URL is the URL actually used for Stripe success/cancel redirects. Restart/redeploy after changing environment values.

Keep Vercel **Production** values separate. Do not copy test keys or test webhook secrets into Production. This ZIP changes source and provides instructions only; it cannot change your Vercel/server environment variables, publish a deployment, or verify live Stripe/Resend dashboards.

## Expected email flow and safety boundary

- Signup OTP is delivered by the configured Resend email sender; console/developer OTP mode is not used.
- A successfully verified Stripe **test-mode** payment causes one payment-confirmation email.
- After that email is accepted, one separate guide email is attempted from `guide@client.zavoryn.tech` with eight inline JPGs, the Cuvva project URL, no PDF attachment, and no password.
- Test-mode checkout is restricted to `STRIPE_TEST_ALLOWED_EMAILS` in all environments. The email provider still sends real messages, so list only inboxes you control.
- No policy is issued and no insurance cover is activated. Live-mode payment is blocked in this build even if an environment file says `LIVE_POLICY_CHECKOUT_ENABLED=true`.
