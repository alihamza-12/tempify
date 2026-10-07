import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  Gauge,
  LockKeyhole,
  MailCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { PlateSearch } from "@/components/home/PlateSearch";

const trustItems = [
  { value: "Live", label: "Vehicle verification", icon: BadgeCheck },
  { value: "24/7", label: "Online availability", icon: Clock3 },
  { value: "Secure", label: "Hosted payment", icon: LockKeyhole },
  { value: "Fast", label: "Email confirmation", icon: MailCheck },
];

const steps = [
  { icon: Search, number: "01", title: "Find your vehicle", text: "Enter your registration. We use provider-verified details and never display manually typed vehicle records." },
  { icon: CalendarClock, number: "02", title: "Choose your cover", text: "Set a start time and duration, then complete your driver, address and licence information." },
  { icon: CreditCard, number: "03", title: "Pay securely", text: "Sign in, continue to hosted checkout and receive confirmation after the payment is verified." },
];

const benefits = [
  { icon: Gauge, title: "Fast by design", text: "A focused journey with server-rendered pages, responsive forms and verified data." },
  { icon: BadgeCheck, title: "Verified vehicles", text: "Database results are used only when they include the original trusted API payload." },
  { icon: ShieldCheck, title: "Private and secure", text: "Secrets stay on the server and card details never pass through our application." },
];

const faqs = [
  ["How quickly can I get a quote?", "Most customers can verify a vehicle and complete the quote form in a few minutes."],
  ["Where do my vehicle details come from?", "We first check our verified cache. If there is no verified API record, we request fresh information from the vehicle provider."],
  ["Do you store my card details?", "No. Payment happens on the payment provider’s secure hosted checkout."],
  ["When will I receive an email?", "A confirmation email is sent only after the server verifies a successful payment."],
];

export default function Home() {
  return (
    <div className="overflow-hidden bg-[#07080b]">
      <section className="relative isolate min-h-[720px] border-b border-white/8">
        <Image src="/images/hero-car.jpg" alt="A modern car on a city street at night" fill priority className="-z-30 object-cover object-center opacity-48" sizes="100vw" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,#07080b_0%,rgba(7,8,11,.94)_38%,rgba(7,8,11,.48)_72%,rgba(7,8,11,.82)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_34%_55%,rgba(255,100,8,.20),transparent_38%)]" />
        <div className="container-shell grid min-h-[650px] items-center gap-12 py-16 lg:grid-cols-[1.03fr_.78fr] lg:py-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/8 px-3.5 py-2 text-xs font-bold text-orange-300">
              <Sparkles size={14} /> Flexible vehicle cover, without the friction
            </div>
            <h1 className="text-5xl font-black leading-[.98] tracking-[-.055em] text-white sm:text-6xl lg:text-7xl">
              Cover that moves at <span className="brand-text">your speed.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Verify your car, choose the time you need and continue to secure checkout—all through one clear, modern journey.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#vehicle-search" className="btn-primary">Get started <ArrowRight size={17} /></a>
              <a href="#how-it-works" className="btn-secondary">How it works</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-400">
              {["API-verified data", "Server-side security", "Payment confirmation"].map((item) => <span key={item} className="flex items-center gap-1.5"><Check size={14} className="text-emerald-400" />{item}</span>)}
            </div>
          </div>
          <div id="vehicle-search" className="scroll-mt-28 lg:translate-y-3"><PlateSearch /></div>
        </div>
      </section>

      <section className="border-b border-white/8 bg-[#0a0c11] py-9">
        <div className="container-shell grid grid-cols-2 gap-3 lg:grid-cols-4">
          {trustItems.map(({ value, label, icon: Icon }) => (
            <div key={label} className="panel rounded-2xl px-4 py-5 text-center">
              <Icon className="mx-auto mb-3 text-orange-400" size={21} />
              <div className="text-xl font-black text-white sm:text-2xl">{value}</div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500 sm:text-xs">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="py-24 sm:py-30">
        <div className="container-shell">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Simple from start to finish</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-.035em] sm:text-5xl">Ready in three clear steps</h2>
            <p className="mt-4 text-slate-400">No confusing menus. Just the information needed to complete your journey.</p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {steps.map(({ icon: Icon, number, title, text }) => (
              <div key={number} className="panel group relative rounded-3xl p-7 transition hover:-translate-y-1 hover:border-orange-500/30">
                <div className="absolute right-6 top-5 text-5xl font-black text-white/[.035]">{number}</div>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20"><Icon size={22} /></div>
                <h3 className="text-xl font-extrabold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-[#090c13] py-24">
        <div className="container-shell">
          <div className="grid items-center gap-12 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <div className="mb-4 flex gap-1 text-amber-400">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={16} fill="currentColor" />)}</div>
              <h2 className="text-3xl font-black tracking-[-.04em] sm:text-5xl">Thoughtful technology. A human experience.</h2>
              <p className="mt-5 max-w-lg leading-7 text-slate-400">Every interaction is designed to be understandable on the first try—from registration search to payment confirmation.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {benefits.map(({ icon: Icon, title, text }) => (
                <div key={title} className="panel rounded-2xl p-6">
                  <Icon size={22} className="text-orange-400" />
                  <h3 className="mt-5 font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container-shell">
          <div className="brand-gradient grid-dots mx-auto max-w-4xl overflow-hidden rounded-[30px] px-6 py-12 text-center shadow-2xl shadow-orange-950/25 sm:px-12">
            <h2 className="text-3xl font-black tracking-[-.04em] text-white sm:text-4xl">Know your registration?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">Start with a quick vehicle check and see your verified car details before entering anything else.</p>
            <a href="#vehicle-search" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 font-extrabold text-orange-600 shadow-lg hover:bg-orange-50">Search now <ArrowRight size={17} /></a>
          </div>
        </div>
      </section>

      <section className="pb-28">
        <div className="container-shell max-w-3xl">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[.18em] text-orange-400">Questions, answered</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Common questions</h2>
          </div>
          <div className="mt-9 space-y-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group panel rounded-2xl px-5 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-bold sm:text-base">{question}<ChevronDown size={17} className="shrink-0 text-orange-400 transition group-open:rotate-180" /></summary>
                <p className="border-t border-white/8 pb-5 pt-4 text-sm leading-6 text-slate-400">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
