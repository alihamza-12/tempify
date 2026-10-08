import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type LegalTone = "orange" | "blue" | "green" | "red" | "purple" | "slate";

const tones: Record<LegalTone, { badge: string; border: string; header: string; text: string }> = {
  orange: {
    badge: "bg-orange-500 text-white shadow-orange-500/25",
    border: "border-orange-500/25",
    header: "bg-gradient-to-r from-orange-500/12 to-transparent",
    text: "text-orange-300",
  },
  blue: {
    badge: "bg-blue-500 text-white shadow-blue-500/25",
    border: "border-blue-500/25",
    header: "bg-gradient-to-r from-blue-500/12 to-transparent",
    text: "text-blue-300",
  },
  green: {
    badge: "bg-emerald-500 text-white shadow-emerald-500/25",
    border: "border-emerald-500/25",
    header: "bg-gradient-to-r from-emerald-500/12 to-transparent",
    text: "text-emerald-300",
  },
  red: {
    badge: "bg-red-500 text-white shadow-red-500/25",
    border: "border-red-500/25",
    header: "bg-gradient-to-r from-red-500/15 to-transparent",
    text: "text-red-300",
  },
  purple: {
    badge: "bg-purple-500 text-white shadow-purple-500/25",
    border: "border-purple-500/25",
    header: "bg-gradient-to-r from-purple-500/15 to-transparent",
    text: "text-purple-300",
  },
  slate: {
    badge: "bg-slate-500 text-white shadow-slate-500/25",
    border: "border-slate-500/25",
    header: "bg-gradient-to-r from-slate-500/12 to-transparent",
    text: "text-slate-300",
  },
};

export function LegalPageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`legal-page min-h-[calc(100vh-145px)] border-t border-orange-500/15 px-3 py-12 text-slate-200 sm:py-16 ${className}`}>
      <div className="legal-content mx-auto w-full max-w-4xl">{children}</div>
    </div>
  );
}

export function LegalHeroCard({
  icon: Icon,
  eyebrow = "Legal Document",
  title,
  subtitle,
  lastUpdated = "7 October 2026",
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle: string;
  lastUpdated?: string;
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-orange-500/25 bg-[radial-gradient(circle_at_80%_10%,rgba(255,101,8,.12),transparent_35%),linear-gradient(125deg,rgba(28,40,60,.94),rgba(11,15,24,.98))] p-5 shadow-2xl shadow-black/30 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/15 text-orange-400">
          <Icon size={25} />
        </div>
        <div>
          <span className="inline-flex rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-orange-300">{eyebrow}</span>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-white sm:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-orange-500/25 bg-orange-950/25 px-4 py-3 text-xs font-semibold text-orange-200">Last updated: {lastUpdated}</div>
    </header>
  );
}

export function LegalSection({
  number,
  title,
  tone = "orange",
  children,
  id,
}: {
  number: number;
  title: string;
  tone?: LegalTone;
  children: ReactNode;
  id?: string;
}) {
  const style = tones[tone];
  return (
    <section id={id} className={`scroll-mt-28 overflow-hidden rounded-2xl border bg-[#0d1421]/94 shadow-xl shadow-black/20 ${style.border}`}>
      <div className={`flex items-center gap-3 border-b border-white/8 px-4 py-4 sm:px-5 ${style.header}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black shadow-lg ${style.badge}`}>{number}</span>
        <h2 className="text-lg font-black text-white sm:text-xl">{title}</h2>
      </div>
      <div className="p-4 text-sm leading-7 text-slate-300 sm:p-5">{children}</div>
    </section>
  );
}

export function LegalInfoCard({
  icon: Icon,
  title,
  children,
  tone = "orange",
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  tone?: LegalTone;
}) {
  const style = tones[tone];
  return (
    <div className={`rounded-xl border bg-black/15 p-4 ${style.border}`}>
      <div className={`flex items-center gap-2 font-extrabold ${style.text}`}><Icon size={17} />{title}</div>
      <div className="mt-2 text-xs leading-5 text-slate-400">{children}</div>
    </div>
  );
}

export function DotList({ children, tone = "orange" }: { children: ReactNode; tone?: LegalTone }) {
  return <ul className={`legal-dot-list ${tones[tone].text}`}>{children}</ul>;
}
