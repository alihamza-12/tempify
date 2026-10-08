import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  Building2,
  Cookie,
  Database,
  Eye,
  FileCheck2,
  FileLock2,
  Gavel,
  KeyRound,
  Mail,
  ServerCog,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { DotList, LegalInfoCard, LegalPageShell, LegalSection } from "@/components/legal/LegalUI";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Tempify collects, uses, stores and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell className="sm:pt-14">
      <header className="mx-auto mb-12 max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/35 bg-orange-500/10 px-4 py-2 text-xs font-extrabold text-orange-300 shadow-lg shadow-orange-500/15"><Shield size={14} /> Legal Document</span>
        <h1 className="mt-6 text-4xl font-black tracking-[-.045em] text-white sm:text-5xl">Our <span className="text-orange-500">Privacy Policy</span></h1>
        <p className="mt-3 text-base text-slate-400 sm:text-lg">Your privacy and data-protection rights explained clearly.</p>
        <p className="mt-5 text-xs font-semibold text-orange-400">Last updated: 7 October 2026</p>
      </header>

      <div className="space-y-5">
        <LegalSection number={1} title="Introduction and Data Controller">
          <p>Tempify is committed to protecting and respecting your privacy. This policy explains how we collect, use, disclose and safeguard personal information when you use our website, account services, vehicle lookup, quoting, checkout and customer support.</p>
          <p className="mt-3 text-slate-400">For information processed directly through Tempify, the business operating Tempify acts as the data controller. Payment, vehicle-data and other providers may also act as separate controllers for information they process under their own privacy notices.</p>
        </LegalSection>

        <LegalSection number={2} title="Information We Collect" tone="blue">
          <div className="grid gap-3 sm:grid-cols-2">
            <LegalInfoCard icon={UserRound} title="Information You Provide" tone="blue">
              <DotList tone="blue"><li>Name, contact details and date of birth</li><li>Address, occupation and driving-licence information</li><li>Account registration and support messages</li><li>Vehicle, quote and requested-cover details</li></DotList>
            </LegalInfoCard>
            <LegalInfoCard icon={ServerCog} title="Information Collected Automatically" tone="green">
              <DotList tone="green"><li>Device, browser and approximate network information</li><li>Security, session and authentication records</li><li>Page interactions, errors and service diagnostics</li><li>Cookie or similar-technology data where used</li></DotList>
            </LegalInfoCard>
            <LegalInfoCard icon={Banknote} title="Payment Information" tone="purple">Tempify stores payment references, order status, amount and provider identifiers. Full card details are entered on the provider&apos;s hosted checkout and are not stored by Tempify.</LegalInfoCard>
            <LegalInfoCard icon={Database} title="Verified Vehicle Data" tone="orange">We process registration numbers and vehicle details returned by the external vehicle provider or our provider-verified cache.</LegalInfoCard>
          </div>
        </LegalSection>

        <LegalSection number={3} title="Legal Basis for Processing" tone="purple">
          <div className="grid gap-3 sm:grid-cols-2">
            <LegalInfoCard icon={FileCheck2} title="Contract Performance" tone="purple">To provide requested account, quote, checkout and support services or take steps at your request.</LegalInfoCard>
            <LegalInfoCard icon={BadgeCheck} title="Legitimate Interests" tone="orange">To secure, improve and operate the service, prevent abuse, resolve errors and understand performance.</LegalInfoCard>
            <LegalInfoCard icon={Gavel} title="Legal Obligations" tone="red">To meet applicable financial, consumer, fraud-prevention, record-keeping and regulatory duties.</LegalInfoCard>
            <LegalInfoCard icon={ShieldCheck} title="Consent" tone="blue">Where consent is the appropriate basis, including certain communications or optional technologies.</LegalInfoCard>
          </div>
        </LegalSection>

        <LegalSection number={4} title="How We Use Your Information">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/6 p-4">
              <h3 className="flex items-center gap-2 font-extrabold text-orange-300"><KeyRound size={17} /> Service Provision</h3>
              <DotList><li>Create and secure accounts</li><li>Verify vehicles and prepare quotes</li><li>Create payment orders and reconcile status</li><li>Send OTPs, confirmations and support replies</li></DotList>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/6 p-4">
              <h3 className="flex items-center gap-2 font-extrabold text-blue-300"><Eye size={17} /> Business Operations</h3>
              <DotList tone="blue"><li>Monitor security and prevent fraud</li><li>Diagnose failures and improve usability</li><li>Maintain transaction and compliance records</li><li>Respond to rights requests and disputes</li></DotList>
            </div>
          </div>
        </LegalSection>

        <LegalSection number={5} title="Sharing, Retention and Your Rights" tone="green">
          <p>Information is shared only where needed with service providers such as hosting, database, email, vehicle-data and payment providers, or where required by law. Providers receive only the information needed for their role and are expected to protect it appropriately.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LegalInfoCard icon={Building2} title="Service Providers" tone="green">MongoDB, Vercel, Resend, RegCheck and PayMeGate may process relevant information for their services.</LegalInfoCard>
            <LegalInfoCard icon={FileLock2} title="Retention" tone="green">Records are kept only as long as reasonably needed for service, legal, security, tax and dispute purposes.</LegalInfoCard>
            <LegalInfoCard icon={Cookie} title="Your Choices" tone="green">You may have rights to access, correct, erase, restrict, object or request portability, subject to applicable exemptions.</LegalInfoCard>
          </div>
          <p className="mt-4 text-xs text-slate-500">We may need to verify your identity before completing a rights request. Some transaction records cannot be deleted immediately where retention is legally required.</p>
        </LegalSection>

        <LegalSection number={6} title="Contact Us">
          <div className="flex items-start gap-3"><Mail size={19} className="mt-1 shrink-0 text-orange-400" /><p>If you have a question about this policy, how information is handled, or want to exercise a data-protection right, contact us through the secure form and use “Data Protection” as the subject.</p></div>
          <Link href="/contact?subject=Data%20Protection#contact-form" className="btn-primary mt-5">Contact Us</Link>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
