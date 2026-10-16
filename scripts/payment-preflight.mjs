// READ ONLY: checks local configuration and GETs merchant configuration.
// Does not create an order, update a wallet/webhook, send email, or take payment.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const fields = ["PAYMEGATE_API_KEY", "PAYMEGATE_WEBHOOK_SECRET", "RESEND_API_KEY", "NEXT_PUBLIC_APP_URL", "MONGODB_URI"];
const report = {
  kind: "read-only payment preflight",
  configurationPresent: Object.fromEntries(fields.map((name) => [name, Boolean(process.env[name]?.trim())])),
  liveCheckoutEnabled: process.env.LIVE_POLICY_CHECKOUT_ENABLED === "true",
  emailDeliveryMode: ["resend", "console"].includes(process.env.EMAIL_DELIVERY_MODE || "resend") ? (process.env.EMAIL_DELIVERY_MODE || "resend") : "unrecognised",
  sourceFingerprint: "",
  provider: {},
  realPaymentTestPerformed: false,
  emailDeliveryTestPerformed: false,
  walletSettlementVerified: false,
};
const files = ["src/app/api/checkout/route.ts", "src/modules/payments/paymegate.ts", "src/modules/payments/validation.ts", "src/modules/payments/fulfillment.ts"];
try {
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update(fs.readFileSync(path.join(process.cwd(), file)));
  report.sourceFingerprint = hash.digest("hex");
} catch { report.sourceFingerprint = "source files not found; run from Tempify root"; }

async function main() {
  if (!process.env.PAYMEGATE_API_KEY?.trim()) {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }
  const base = new URL(process.env.PAYMEGATE_BASE_URL || "https://api.paymegate.com");
  if (base.protocol !== "https:" || !["api.paymegate.com", "www.paymegate.com"].includes(base.hostname) || base.username || base.password || base.search || base.hash || base.port) {
    throw new Error("Refusing to send a merchant key to an unrecognised API origin.");
  }
  const get = async (endpoint) => {
    const response = await fetch(`${base.href.replace(/\/$/, "")}${endpoint}`, {
      headers: { "X-API-Key": process.env.PAYMEGATE_API_KEY.trim() },
      signal: AbortSignal.timeout(15_000),
      redirect: "error", // Never forward the key across a redirect.
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, data: response.ok && body?.success === true ? body.data : null };
  };
  const [wallet, webhook, methods] = await Promise.all([get("/v1/wallet"), get("/v1/webhook"), get("/v1/payment-methods")]);
  const expectedWebhook = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/paymegate`
    : null;
  report.provider = {
    walletHttpStatus: wallet.status,
    walletConfigured: wallet.data?.configured === true,
    customWallet: wallet.data?.walletType === "custom",
    configuredNetworks: Array.isArray(wallet.data?.configuredCryptoNetworks) ? wallet.data.configuredCryptoNetworks.filter((network) => ["evm", "btc", "bitcoincash", "ltc", "doge", "solana", "trc20", "zec", "xmr"].includes(network)) : [],
    cryptoEnabled: wallet.data?.includeCrypto === true,
    webhookHttpStatus: webhook.status,
    webhookActive: webhook.data?.status === "active",
    webhookMatchesApp: Boolean(expectedWebhook && webhook.data?.url === expectedWebhook),
    paidEventSubscribed: Boolean(webhook.data?.events?.includes("order.paid")),
    methodsHttpStatus: methods.status,
    paymentMethods: (Array.isArray(methods.data?.paymentMethods) ? methods.data.paymentMethods : []).filter((method) => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(method.key) && /^[0-9]{1,18}(?:\.[0-9]{1,3})?$/.test(method.minimumAmount) && /^[A-Z]{3}$/.test(method.minimumCurrency)).map((method) => ({ key: method.key, minimumAmount: method.minimumAmount, minimumCurrency: method.minimumCurrency })),
  };
  console.log(JSON.stringify(report, null, 2));
  console.log("Read-only check complete. No keys, signing secrets, database URI, wallet addresses or personal contact details were printed. This does NOT prove payment, inbox delivery or wallet settlement.");
}
main().catch(() => {
  console.log(JSON.stringify(report, null, 2));
  console.error("Preflight could not complete. Check the endpoint/connectivity locally; do not share environment values.");
  process.exitCode = 1;
});
