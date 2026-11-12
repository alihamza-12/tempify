export function canUseStripeTestCheckout(input: {
  secretKey?: string;
  nodeEnv?: string;
  enabledInProduction?: string;
}) {
  const key = input.secretKey?.trim() || "";
  if (!key.startsWith("sk_test_")) return false;
  return input.nodeEnv !== "production" || input.enabledInProduction === "true";
}

export function isAllowedTestCheckoutEmail(email: string, allowlist?: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !allowlist?.trim()) return false;
  return new Set(allowlist.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)).has(normalized);
}
