import { ContentPage } from "@/components/layout/ContentPage";
export default function ReturnPolicyPage() { return <ContentPage title="Refund Policy" intro="Refund eligibility depends on whether payment and fulfillment have completed and on the payment method used." sections={[
  { title: "Before payment", body: "You can leave the checkout before payment without charge. Unpaid checkout sessions expire automatically." },
  { title: "After payment", body: "Contact support with your order reference. Do not send card details, passwords, one-time codes or wallet seed phrases. On-chain payments can be irreversible and provider-funded payments follow provider-specific dispute rules." },
  { title: "Processing", body: "Where a refund is approved, timing and method depend on the original payment rail and provider. Fees already incurred may not be recoverable where permitted by law." },
]} />; }
