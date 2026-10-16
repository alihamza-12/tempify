# TEMPIFY — Next.js vehicle quote and checkout

A production-oriented, modular Next.js application for provider-verified UK vehicle lookup, quote collection, OTP account registration, hosted PayMeGate checkout, payment reconciliation, and Resend transactional email.

## What is included

- Original responsive Tempify UI based on the supplied screenshots
- Next.js App Router + TypeScript + Tailwind CSS
- Server-rendered pages and Node.js Route Handlers
- MongoDB/Mongoose with serverless connection caching
- RegCheck vehicle lookup kept entirely server-side
- Verified-only vehicle cache; manually entered legacy vehicles are ignored
- Multi-section quote journey and isolated pricing module
- Email OTP registration and bcrypt password hashes
- One shared Cuvva/Tempify database with the same `users` and verified `vehicles` collections
- Editable customer profile and quote pre-fill using the shared customer record
- HTTP-only JWT session cookie
- Authentication gate before checkout
- PayMeGate order creation, hosted checkout redirect, signed webhook verification, idempotency, and status reconciliation
- Resend OTP, post-payment confirmation, and validated support-form emails
- Responsive animated legal/support pages with signed robot verification
- Account order history
- PWA manifest and post-payment add-to-home-screen instructions
- Unit tests for pricing, registration normalization, and webhook HMAC verification

## Important business/compliance boundary

The quote form allows a customer to select a past start date/time and applies a higher price on the server. A quote or payment confirmation does not by itself establish cover for an elapsed period, and the application does not generate fake insurance documents or AI-generated documents. Before representing any output as an insurance policy, connect the application to an authorized insurer/underwriter and have the complete product, wording, historical-start eligibility, pricing, regulatory disclosures, and fulfillment reviewed by qualified UK insurance/compliance professionals.

## Requirements

- Node.js 20+
- MongoDB reachable from the deployed application
- RegCheck account(s)
- Resend account with `cuvvapolicies.com` verified
- PayMeGate merchant account for live payment testing

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

For local OTP testing, keep:

```env
EMAIL_DELIVERY_MODE=console
```

The API response and terminal will show the development OTP. Never use console delivery in production.

## Environment variables

Copy `.env.example` and configure:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | The exact existing local Cuvva database URI; both projects use this one database |
| `SHARED_INTEGRATION_OWNER_ID` | Existing active Cuvva Super Admin ObjectId assigned as `createdBy` for provider-created shared vehicles |
| `SESSION_SECRET` | Signs the Tempify host-only secure session cookie |
| `REGCHECK_USERNAMES` | Comma-separated RegCheck usernames |
| `RESEND_API_KEY` | Server-side Resend key |
| `EMAIL_FROM` | `Tempify <auto@cuvvapolicies.com>` |
| `CONTACT_TO_EMAIL` | Receives validated support/contact-form messages |
| `EMAIL_DELIVERY_MODE` | `console` locally, `resend` in production |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS site origin |
| `LIVE_POLICY_CHECKOUT_ENABLED` | Must remain `false` until written policy-issuance authority and fulfilment are confirmed |
| `PAYMEGATE_API_KEY` | PayMeGate live merchant key |
| `PAYMEGATE_WEBHOOK_SECRET` | One-time signing secret returned on webhook registration |
| `PAYMEGATE_BASE_URL` | Defaults to `https://api.paymegate.com` |
| `PAYMENT_CURRENCY` | Defaults to `GBP`; confirm live method support with PayMeGate |

Do not prefix API keys, database credentials, or webhook secrets with `NEXT_PUBLIC_`.

## One shared MongoDB database

Cuvva and Tempify use the exact same local MongoDB database URI. If Cuvva uses:

```env
MONGODB_URI=mongodb://APP_USER:PASSWORD@127.0.0.1:27017/cuvva?authSource=admin
```

Tempify uses the same value:

```env
MONGODB_URI=mongodb://APP_USER:PASSWORD@127.0.0.1:27017/cuvva?authSource=admin
SHARED_INTEGRATION_OWNER_ID=EXISTING_ACTIVE_CUVVA_SUPER_ADMIN_OBJECT_ID
```

Equivalent business entities are not duplicated:

- Both applications authenticate against the same `users` collection. A Tempify customer receives the Cuvva-compatible `Customer` role and can use the same email/password in the Cuvva customer application.
- Both applications use the same `vehicles` collection and original `regCheckData` verification marker.
- The existing `policies` collection remains the future shared destination for authorised policy issuance.
- Tempify-only workflow state—pending OTPs, quotes and PayMeGate orders/webhook idempotency—uses support collections in this same database because these records have no safe equivalent in Cuvva.

Tempify never writes to a second logical database and no longer writes a duplicate `tempify_verified_vehicles` cache. Keep MongoDB bound to localhost/private networking and never expose port `27017` publicly.

During setup, obtain the shared integration owner once:

```javascript
use CUVVA_DATABASE_NAME
db.users.findOne({ role: "Super Admin", status: "Active" }, { _id: 1 })
```

Vehicle lookup order is:

1. Check the shared `vehicles` collection for `lookupSource="regcheck"` and a non-empty original `regCheckData` object.
2. Return that verified record to either project without spending a RegCheck credit.
3. Call RegCheck only when the shared verified record does not exist.
4. Upsert the provider result into the same shared `vehicles` row with `lookupSource="regcheck"`, original `regCheckData`, `verified=true`, verification timestamps and the configured integration owner.
5. Display the saved provider result.

Manual/unverified vehicle rows are never authoritative. An existing manual row for the same registration is upgraded only after a successful RegCheck response. No Cuvva source-code changes are required.

## Customer details and checkout gate

The quote page loads an authenticated customer's shared profile and keeps every field editable. It includes name, email, date of birth, gender, occupation, mobile, driving licence, licence history, residential address/county/postcode, fixed country `GB`, and optional last-four card digits. The account page edits the same shared `users` record.

The server checks the complete customer, licence, verified vehicle and VIN data again before creating a PayMeGate order. Client-side form completion alone cannot bypass this check.

Because written Cuvva/Wakam issuance authority was not confirmed, `LIVE_POLICY_CHECKOUT_ENABLED` defaults to `false`. This build does not create a Cuvva policy or legal certificate. A verified paid order now automatically receives the Cuvva-template email with one dynamically filled sample PDF and the two original template PDFs. All three attachments have a small SAMPLE - NOT VALID INSURANCE - NO POLICY ISSUED footer; the email also identifies them as samples. The order remains `blocked_pending_authority`, with no insurance policy created. Do not enable live collection until the approved insurer/underwriter supplies written authority and a separately reviewed fulfilment module has been implemented.

## PayMeGate activation

Payment code is implemented but remains safely unavailable until both written issuance authority and credentials are configured.

1. Obtain written authority and implement/review the authorised insurer fulfilment module before setting `LIVE_POLICY_CHECKOUT_ENABLED=true`.
2. Use the business/client-controlled PayMeGate merchant account.
3. Configure a self-custodial EVM payout wallet (for example Coinbase Wallet, MetaMask, Trust Wallet, or Rabby). Do not use a Coinbase Exchange deposit address.
4. Create the server API key (recommended name: `Tempify Production`). Leave refund/cancellation, product management, wallet update, and webhook URL update permissions OFF.
5. Save `PAYMEGATE_API_KEY` only in the server's protected production environment.
6. Deploy Tempify on its separate HTTPS root domain.
7. Register this webhook URL:

```text
https://YOUR-DOMAIN/api/webhooks/paymegate
```

8. Save the one-time signing secret immediately as `PAYMEGATE_WEBHOOK_SECRET`.
9. Set `NEXT_PUBLIC_APP_URL=https://YOUR-DOMAIN`.
10. Confirm supported currency and active methods using the merchant dashboard/API.
11. Only after authority and fulfilment approval, test with a controlled order and verify webhook, reconciliation, sample-document email and wallet settlement.

The browser receives only PayMeGate's hosted `checkoutUrl`. API keys and payment-provider details never reach client JavaScript. Apple Pay, Google Pay, card, and other methods are eligibility-dependent and are displayed by PayMeGate's hosted checkout.

## Email activation

Create a **separate Resend API key for this project** while using the already verified sender domain:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Tempify <auto@cuvvapolicies.com>
CONTACT_TO_EMAIL=support@cuvvapolicies.com
EMAIL_DELIVERY_MODE=resend
```

OTP emails are sent during registration. A Cuvva-template payment email and three sample-labelled PDFs are sent after a signed PayMeGate webhook or direct server reconciliation confirms a matching `PAID` order. This is connected directly to paid-order fulfillment, with no additional policy-email enable variable. It creates no insurance cover. See `docs/REPLACE_FILES_GUIDE.md` for installation, required existing email credentials and retry behavior. The contact form sends validated, rate-limited messages to `CONTACT_TO_EMAIL` with the customer address set as the reply-to address.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Same-server production deployment

Keep the existing Cuvva application and its port unchanged. The applications do not need different public IP addresses: both domains can point to the server's same public IP, while Nginx routes each hostname to a different localhost application port. Deploy Tempify from its own directory and run it on a second port, for example `127.0.0.1:3001`:

```bash
npm ci
npm run build
NODE_ENV=production PORT=3001 npm run start
```

Use systemd or PM2 to keep that process running. Store production secrets in a protected server environment file (mode `600`), not in Git. Set `NEXT_PUBLIC_APP_URL` to the final Tempify HTTPS origin.

Create a separate Nginx virtual host for the new root domain and proxy it only to Tempify:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name YOUR-TEMPIFY-DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

After its DNS A record (and AAAA only when the server has working IPv6) resolves to the server, validate and enable Nginx, then issue HTTPS:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR-TEMPIFY-DOMAIN -d www.YOUR-TEMPIFY-DOMAIN
```

Configure the PayMeGate webhook only after the final HTTPS endpoint responds successfully.

### Free separate domain option

For a zero-cost independently registered address, `.pp.ua` is currently available from accredited registrars such as [NIC.UA](https://nic.ua/en/domains/.pp.ua). For example, `tempify.pp.ua` is independent of the Cuvva domain and supports normal DNS and HTTPS. Registration and renewal are free, but the registrant must activate it by phone/Telegram, renew it manually each year, and accept that registrant contact details are public. Check the official [PP.UA rules](https://pp.ua/eng/policy.html) before using it for a production payment site.

At the registrar, create an `A` record for `@` pointing to the server's public IPv4 address and a `CNAME` for `www` pointing to the root name. Use that hostname in the Nginx `server_name`, `NEXT_PUBLIC_APP_URL`, Certbot command and PayMeGate webhook URL. Do not point DNS directly to port `3001`; DNS points to the server IP and Nginx performs the port routing.

If a conventional address such as `.com`, `.co.uk` or `.uk` is required, it is not permanently free; use an at-cost registrar such as [Cloudflare Registrar](https://www.cloudflare.com/domains/) rather than GoDaddy.

## Key folders

```text
src/app                  Pages and API Route Handlers
src/components           UI grouped by feature
src/models               Mongoose models
src/modules/auth         OTP/account business logic
src/modules/profile      Shared Cuvva/Tempify customer profile validation
src/modules/contact      Contact-form validation
src/modules/vehicles     Shared verified lookup and provider adapter
src/modules/quotes       Validation and pricing
src/modules/payments     PayMeGate client, HMAC, fulfillment
src/modules/documents    Legacy receipt renderer (retained for compatibility)
src/modules/policy-documents Original Cuvva renderer, quote snapshots and mandatory sample labels
src/modules/email        Resend templates and delivery
src/lib                  Database, sessions, HTTP helpers, rate limiting
```

## Before production

- Replace draft legal/support copy with business-approved content.
- Confirm the business is legally authorized to sell/arrange the described product.
- Connect post-payment fulfillment to the authorized policy issuer, if applicable.
- Replace the in-memory general rate limiter with a durable service such as Vercel KV/Upstash.
- Configure monitoring and alerts for failed webhook processing and email delivery.
- Run a security review and end-to-end live payment test.

## Final payment audit (15 October 2026)

See [PAYMENT_FINAL_AUDIT.md](docs/PAYMENT_FINAL_AUDIT.md) for the additional checkout/payment-verification fixes, 88 passing automated tests, new isolated MongoDB integration suite, and the still-pending live-payment/inbox/wallet checks. Run `npm run test:payment:integration` separately from `npm test`. The existing checkout gate and sample labels remain unchanged.
