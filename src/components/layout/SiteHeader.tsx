import Image from "next/image";
import Link from "next/link";
import { SessionNav } from "./SessionNav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#07080b]/88 backdrop-blur-xl">
      <div className="container-shell flex h-18 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Tempify home">
          <Image src="/brand/tempify-mark.png" width={30} height={30} alt="" className="rounded-md" priority />
          <span className="brand-text text-xl font-black tracking-[-.04em]">TEMPIFY</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-slate-300">
          <Link href="/#how-it-works" className="hidden hover:text-white md:block">How it works</Link>
          <Link href="/contact" className="hidden hover:text-white sm:block">Contact</Link>
          <SessionNav />
        </nav>
      </div>
    </header>
  );
}
