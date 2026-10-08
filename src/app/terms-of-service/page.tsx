import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgePoundSterling,
  BadgeCheck,
  CarFront,
  Clock3,
  CreditCard,
  FileText,
  Gauge,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  ReceiptText,
  Scale,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { DotList, LegalHeroCard, LegalInfoCard, LegalPageShell, LegalSection } from "@/components/legal/LegalUI";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing use of Tempify vehicle lookup, quoting, accounts and checkout.",
};

export default function TermsPage() {
  return (
    <LegalPageShell>
      <LegalHeroCard icon={FileText} title="Terms of Service" subtitle="Legal agreement governing use of our services" />

      <div className="mt-6 space-y-4">
        <LegalSection number={1} title="Agreement Overview">
          <p>These Terms of Service form an agreement between you and Tempify when you access the website, create an account, request a vehicle quote, or continue to hosted checkout.</p>
          <p className="mt-3 text-slate-400">By using the service, you confirm that you have read these terms and the Privacy Policy, that you are legally able to provide the requested information, and that the information you submit is accurate.</p>
        </LegalSection>

        <LegalSection number={2} title="Service Description" tone="blue">
          <p>Tempify provides a digital journey for provider-verified vehicle lookup, quote information, account verification, and access to hosted payment. The website does not store full payment-card details.</p>
          <div className="mt-4 rounded-xl border-l-2 border-amber-400 bg-amber-500/8 p-4 text-xs leading-5 text-slate-400">
            <strong className="text-amber-300">Important service information:</strong> A quote, account, payment attempt or confirmation page does not by itself prove that insurance cover exists. Any cover remains subject to successful payment verification, eligibility checks, insurer or provider acceptance, and the applicable policy documents.
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LegalInfoCard icon={CarFront} title="Verified Vehicle Lookup" tone="blue">Vehicle details come from an external provider or a cache backed by the original verified provider payload.</LegalInfoCard>
            <LegalInfoCard icon={Gauge} title="Flexible Quote Journey" tone="blue">Choose a duration and requested start, then provide the information required for pricing.</LegalInfoCard>
            <LegalInfoCard icon={Clock3} title="Start-Date Pricing" tone="blue">A past requested start may receive a higher server-calculated price and remains subject to eligibility.</LegalInfoCard>
            <LegalInfoCard icon={LockKeyhole} title="Secure Processing" tone="blue">Sensitive credentials and integration secrets stay on the server; checkout is hosted by the payment provider.</LegalInfoCard>
          </div>
        </LegalSection>

        <LegalSection number={3} title="Payment Terms" tone="orange">
          <p>Prices are displayed before checkout. Payment methods and their availability depend on the payment provider, device, region, currency and transaction amount.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LegalInfoCard icon={CreditCard} title="Third-Party Checkout">You may be redirected to a secure hosted checkout. The provider&apos;s additional terms and checks apply.</LegalInfoCard>
            <LegalInfoCard icon={BadgePoundSterling} title="Pricing">The server calculates the final quote using duration, requested start and the current pricing version.</LegalInfoCard>
            <LegalInfoCard icon={ReceiptText} title="Payment Confirmation" tone="green">An order is treated as paid only after a verified webhook or server-to-server reconciliation confirms settlement.</LegalInfoCard>
            <LegalInfoCard icon={ShieldCheck} title="Refunds and Disputes" tone="purple">Refund eligibility is governed by the Return Policy, applicable provider terms and mandatory law.</LegalInfoCard>
          </div>
        </LegalSection>

        <LegalSection number={4} title="User Obligations & Acceptable Use" tone="red">
          <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-4">
            <div className="flex items-center gap-2 font-extrabold text-red-300"><ShieldAlert size={17} /> Your responsibilities</div>
            <DotList tone="red">
              <li>Provide truthful, complete and current driver, vehicle, address and licence information.</li>
              <li>Use only accounts and payment methods you are authorised to use.</li>
              <li>Check provider-returned vehicle details before continuing.</li>
              <li>Do not misuse a past start-date option to misrepresent when cover exists.</li>
              <li>Do not attempt fraud, automated abuse, unauthorised access or payment manipulation.</li>
              <li>Keep your password and one-time verification codes confidential.</li>
            </DotList>
          </div>
        </LegalSection>

        <LegalSection number={5} title="Accounts, Availability & Security" tone="purple">
          <div className="grid gap-3 sm:grid-cols-2">
            <LegalInfoCard icon={KeyRound} title="Account Security" tone="purple">You are responsible for activity performed through your account and should contact us if you suspect unauthorised access.</LegalInfoCard>
            <LegalInfoCard icon={UserRoundCheck} title="Eligibility" tone="purple">We or a provider may request further information or decline a transaction where eligibility checks are not met.</LegalInfoCard>
            <LegalInfoCard icon={BadgeCheck} title="Service Integrity" tone="purple">We may suspend access to protect customers, investigate abuse, comply with law, or maintain the platform.</LegalInfoCard>
            <LegalInfoCard icon={Clock3} title="Availability" tone="purple">We aim for reliable access but do not promise uninterrupted service or that every registration or payment method will be available.</LegalInfoCard>
          </div>
        </LegalSection>

        <LegalSection number={6} title="Liability and Changes" tone="slate">
          <p>Nothing in these terms excludes liability that cannot legally be excluded. To the extent permitted by law, Tempify is not responsible for losses caused by inaccurate information you provide, failures outside our reasonable control, or separate services supplied by third-party providers.</p>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-500/25 bg-slate-500/8 p-4"><Scale size={18} className="mt-1 shrink-0 text-slate-300" /><p className="text-xs leading-5 text-slate-400">We may update these terms to reflect service, legal, security or provider changes. The updated date shown at the top identifies the current version.</p></div>
        </LegalSection>

        <LegalSection number={7} title="Contact Us">
          <div className="flex items-start gap-3"><MessageSquareText className="mt-1 shrink-0 text-orange-400" size={19} /><p>If you have a question about these terms or the Tempify service, send it through our contact form. Never include passwords, one-time codes or full card details.</p></div>
          <Link href="/contact?subject=Terms%20of%20Service%20question#contact-form" className="btn-primary mt-5">Contact Us</Link>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
