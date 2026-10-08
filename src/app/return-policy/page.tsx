import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CirclePoundSterling,
  Clock3,
  ContactRound,
  FileSearch,
  Landmark,
  MessageSquareText,
  RefreshCcw,
  Scale,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { DotList, LegalHeroCard, LegalInfoCard, LegalPageShell, LegalSection } from "@/components/legal/LegalUI";

export const metadata: Metadata = {
  title: "Return Policy",
  description: "Tempify refund eligibility, cancellation information and support process.",
};

const supportHref = "/contact?subject=Refund%20request&source=return-policy#contact-form";
const refundSteps = [
  { icon: ContactRound, title: "Step 1: Contact Us", text: "Open the support form and select a refund-related subject." },
  { icon: FileSearch, title: "Step 2: Provide Details", text: "Include your order reference, payment date and a clear explanation." },
  { icon: BadgeCheck, title: "Step 3: Review", text: "We review the payment and service status, then email the outcome." },
];

export default function ReturnPolicyPage() {
  return (
    <LegalPageShell>
      <LegalHeroCard icon={ShieldCheck} title="Return Policy" subtitle="Understanding your refund and cancellation rights" />

      <p className="my-6 text-sm leading-7 text-slate-400">
        This policy explains how refund and cancellation requests are handled for Tempify quotes, payments and related vehicle-cover services. Any insurance eligibility or cover decision remains subject to the applicable provider&apos;s terms.
      </p>

      <div className="space-y-4">
        <LegalSection number={1} title="Policy Overview">
          <p>We review refund requests fairly and in accordance with applicable UK consumer law, the status of the requested cover, and the rules of the payment method used.</p>
          <div className="mt-4 rounded-xl border-l-2 border-amber-400 bg-amber-500/8 p-4">
            <div className="flex items-center gap-2 font-extrabold text-amber-300"><TriangleAlert size={16} /> Important notice</div>
            <p className="mt-2 text-xs leading-5 text-slate-400">Submitting a request does not automatically guarantee a refund. We first check whether payment settled, whether the service or cover period started, and whether any provider costs have already been incurred.</p>
          </div>
        </LegalSection>

        <LegalSection number={2} title="When a Refund May Be Available" tone="green">
          <p>A refund or payment correction may be considered in situations such as:</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LegalInfoCard icon={RefreshCcw} title="Duplicate Payment" tone="green">The same order was charged more than once.</LegalInfoCard>
            <LegalInfoCard icon={XCircle} title="Failed Fulfilment" tone="green">Payment was verified but the purchased service could not be provided.</LegalInfoCard>
            <LegalInfoCard icon={Clock3} title="Before the Start" tone="green">You contact us before the requested cover starts and cancellation is permitted.</LegalInfoCard>
            <LegalInfoCard icon={TriangleAlert} title="Technical Error" tone="green">A confirmed platform or provider error caused an incorrect transaction.</LegalInfoCard>
          </div>
        </LegalSection>

        <LegalSection number={3} title="Non-Refundable Circumstances" tone="red">
          <p>Subject to your statutory rights, a refund may be unavailable where:</p>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <DotList tone="red">
              <li>The requested cover period has started or ended.</li>
              <li>Incorrect or incomplete information was supplied.</li>
              <li>The request is made only because you changed your mind after fulfilment began.</li>
            </DotList>
            <DotList tone="red">
              <li>There is evidence of abuse, fraud or misrepresentation.</li>
              <li>A non-recoverable provider fee was incurred, where the law allows it.</li>
              <li>The request falls outside an applicable provider cancellation right.</li>
            </DotList>
          </div>
        </LegalSection>

        <LegalSection number={4} title="How to Request a Refund">
          <div className="grid gap-3 sm:grid-cols-3">
            {refundSteps.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-orange-500/25 bg-orange-950/15 p-4 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/25"><Icon size={18} /></span>
                <h3 className="mt-3 text-sm font-extrabold text-orange-200">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-xs text-blue-200"><strong>Typical review time:</strong> We aim to respond within two to three business days. Complex provider investigations may take longer.</div>
        </LegalSection>

        <LegalSection number={5} title="Your UK Consumer Rights" tone="blue">
          <p>Nothing in this policy limits rights that cannot lawfully be excluded. Depending on the product and circumstances, you may be entitled to an appropriate remedy where a service is not provided with reasonable care and skill, is not as described, or is not fit for its stated purpose.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LegalInfoCard icon={CheckCircle2} title="Reasonable Care" tone="blue">Services should be provided with reasonable care and skill.</LegalInfoCard>
            <LegalInfoCard icon={Scale} title="Statutory Rights" tone="blue">Mandatory consumer protections continue to apply.</LegalInfoCard>
            <LegalInfoCard icon={ShieldCheck} title="Fair Review" tone="blue">Requests are considered against the facts and applicable terms.</LegalInfoCard>
          </div>
        </LegalSection>

        <LegalSection number={6} title="Payment Processing" tone="purple">
          <p>Payments and refunds are processed through third-party payment providers. Approved refunds are normally sent back through the original payment method.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <LegalInfoCard icon={CirclePoundSterling} title="Original Payment Method" tone="purple">Provider processing times and banking delays can affect when funds appear.</LegalInfoCard>
            <LegalInfoCard icon={Banknote} title="Currency and Fees" tone="purple">Exchange-rate differences or external fees may be outside Tempify&apos;s control.</LegalInfoCard>
          </div>
        </LegalSection>

        <LegalSection number={7} title="Dispute Resolution" tone="slate">
          <p>Please contact us first so we can investigate and try to resolve your concern directly. If it cannot be resolved, any available alternative dispute resolution or payment-provider process will depend on the service and applicable law.</p>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-500/25 bg-slate-500/8 p-4 text-xs text-slate-400"><Landmark size={18} className="mt-0.5 shrink-0 text-slate-300" /> Keep copies of your order reference, confirmation email and correspondence. Never send passwords, one-time codes or full card details.</div>
        </LegalSection>

        <LegalSection number={8} title="Contact Information">
          <div className="flex items-start gap-3"><MessageSquareText className="mt-1 shrink-0 text-orange-400" size={19} /><p>For refund requests or questions about this policy, use our secure contact form. We aim to acknowledge enquiries promptly.</p></div>
          <Link href={supportHref} className="btn-primary mt-5 w-full">Contact Support for Refund Request</Link>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
