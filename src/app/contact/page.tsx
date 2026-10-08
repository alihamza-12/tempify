import type { Metadata } from "next";
import { Clock3, Mail, Shield, Siren } from "lucide-react";
import { ContactForm } from "@/components/contact/ContactForm";
import { LegalPageShell } from "@/components/legal/LegalUI";

export const metadata: Metadata = {
  title: "Contact Support",
  description: "Contact Tempify support about quotes, payments, refunds, accounts or data protection.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const parameters = await searchParams;
  const initialSubject = typeof parameters.subject === "string"
    ? parameters.subject.slice(0, 120)
    : "";

  return (
    <LegalPageShell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/35 bg-orange-500/10 px-4 py-2 text-xs font-extrabold text-orange-300 shadow-lg shadow-orange-500/15"><Mail size={14} /> Get in Touch</span>
          <h1 className="mt-6 text-4xl font-black tracking-[-.045em] text-white sm:text-5xl">We&apos;re Here to <span className="text-orange-500">Help</span></h1>
          <p className="mt-3 text-base text-slate-400 sm:text-lg">Have questions or need support? Send us a secure message.</p>
        </header>

        <ContactForm initialSubject={initialSubject} />

        <section className="mt-7 rounded-2xl border border-orange-500/25 bg-[#0d1421]/96 p-5 shadow-2xl shadow-black/25 sm:p-7">
          <h2 className="text-2xl font-black text-white">Support Information</h2>
          <div className="mt-5 space-y-3">
            <SupportItem icon={Clock3} title="24/7 Form Availability">The online support form is available at any time. We aim to respond to enquiries within 24 hours.</SupportItem>
            <SupportItem icon={Shield} title="Data Protection">For data-protection enquiries, use “Data Protection” in the subject line so the request can be routed correctly.</SupportItem>
            <div className="rounded-xl border border-orange-500/30 bg-orange-950/25 p-4">
              <div className="flex items-center gap-2 font-extrabold text-orange-300"><Siren size={18} /> Urgent Support</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">For an urgent technical or payment issue, start the subject with “Urgent” and include your order reference. Never include full card details, passwords or one-time codes.</p>
            </div>
          </div>
        </section>
      </div>
    </LegalPageShell>
  );
}

function SupportItem({ icon: Icon, title, children }: { icon: typeof Clock3; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white shadow-lg shadow-orange-500/25"><Icon size={19} /></span>
      <div><h3 className="font-extrabold text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{children}</p></div>
    </div>
  );
}
