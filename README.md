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
- Shared `users` collection compatibility with the supplied Cuvva database
- HTTP-only JWT session cookie
- Authentication gate before checkout
- PayMeGate order creation, hosted checkout redirect, signed webhook verification, idempotency, and status reconciliation
- Resend OTP and post-payment confirmation emails
- Account order history
- PWA manifest and post-payment add-to-home-screen instructions
- Unit tests for pricing, registration normalization, and webhook HMAC verification

## Important business/compliance boundary

The application intentionally rejects a cover start time in the past. It does not generate backdated policies, fake insurance documents, or AI-generated documents. The post-payment message is a purchase confirmation. Before representing any output as an insurance policy, connect the application to an authorized insurer/underwriter and have the complete product, wording, pricing, eligibility, regulatory disclosures, and fulfillment reviewed by qualified UK insurance/compliance professionals.

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
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Signs the secure session cookie |
| `REGCHECK_USERNAMES` | Comma-separated RegCheck usernames |
| `RESEND_API_KEY` | Server-side Resend key |
| `EMAIL_FROM` | `Tempify <auto@cuvvapolicies.com>` |
| `EMAIL_DELIVERY_MODE` | `console` locally, `resend` in production |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS site origin |
| `PAYMEGATE_API_KEY` | PayMeGate live merchant key |
| `PAYMEGATE_WEBHOOK_SECRET` | One-time signing secret returned on webhook registration |
| `PAYMEGATE_BASE_URL` | Defaults to `https://api.paymegate.com` |
| `PAYMENT_CURRENCY` | Defaults to `GBP`; confirm live method support with PayMeGate |

Do not prefix API keys, database credentials, or webhook secrets with `NEXT_PUBLIC_`.

## Sharing the existing MongoDB database

The application uses the existing `users` collection shape and bcrypt passwords, so customers can use the same credentials when both applications point to the same database.

It reads existing vehicle data only when:

- `lookupSource` is `regcheck`, and
- the original non-empty `regCheckData` object exists.

Manual vehicle rows are never returned by customer lookup. Newly verified lookups are stored in `tempify_verified_vehicles` to avoid mutating the existing admin-owned `vehicles` model.

### Vercel cannot use your server's `localhost`

If MongoDB is installed locally on a Hostinger server, this will **not** work from Vercel:

```env
MONGODB_URI=mongodb://localhost:27017/database
```

`localhost` on Vercel means the temporary Vercel function itself, not Hostinger. Recommended solution:

1. Move the database to MongoDB Atlas.
2. Update the existing Cuvva backend and this project to the same Atlas URI/database.
3. Configure a database user with a strong password and least-privilege access.
4. Never expose an unauthenticated MongoDB port publicly.

A private network/tunnel is another option, but it requires infrastructure outside this single Vercel project.

## PayMeGate activation

Payment code is implemented but remains safely unavailable until credentials are configured.

1. Create a PayMeGate merchant account.
2. Configure and verify the payout wallet and network in the PayMeGate dashboard.
3. Create a scoped API key with order permissions.
4. Add `PAYMEGATE_API_KEY` to Vercel.
5. Deploy to obtain the production HTTPS URL.
6. Register this webhook URL:

```text
https://YOUR-DOMAIN/api/webhooks/paymegate
```

7. Save the one-time signing secret immediately as `PAYMEGATE_WEBHOOK_SECRET`.
8. Set `NEXT_PUBLIC_APP_URL=https://YOUR-DOMAIN`.
9. Confirm supported currency and active methods using the merchant dashboard/API.
10. Test with a small live order and verify webhook, reconciliation, email, and wallet settlement.

The browser receives only PayMeGate's hosted `checkoutUrl`. API keys and payment-provider details never reach client JavaScript. Apple Pay, Google Pay, card, and other methods are eligibility-dependent and are displayed by PayMeGate's hosted checkout.

## Email activation

Create a **separate Resend API key for this project** while using the already verified sender domain:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Tempify <auto@cuvvapolicies.com>
EMAIL_DELIVERY_MODE=resend
```

OTP emails are sent during registration. The payment confirmation email is sent only after a signed PayMeGate webhook or direct server reconciliation confirms `PAID`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy to Vercel

1. Push this folder to a private GitHub repository.
2. Import it into Vercel as a Next.js project.
3. Add all production environment variables in Vercel Project Settings.
4. Deploy.
5. Configure the PayMeGate webhook after the final HTTPS domain is active.
6. Run the go-live checklist above.

## Key folders

```text
src/app                  Pages and API Route Handlers
src/components           UI grouped by feature
src/models               Mongoose models
src/modules/auth         OTP/account business logic
src/modules/vehicles     Verified lookup and provider adapter
src/modules/quotes       Validation and pricing
src/modules/payments     PayMeGate client, HMAC, fulfillment
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
