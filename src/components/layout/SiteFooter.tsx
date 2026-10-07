import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-black py-8">
      <div className="container-shell flex flex-col items-center justify-between gap-6 sm:flex-row">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/tempify-mark.png" width={24} height={24} alt="" />
          <span className="brand-text font-black">TEMPIFY</span>
        </Link>
        <div className="flex flex-wrap justify-center gap-5 text-xs text-slate-500">
          <Link href="/privacy-policy" className="hover:text-slate-300">Privacy Policy</Link>
          <Link href="/terms-of-service" className="hover:text-slate-300">Terms of Service</Link>
          <Link href="/return-policy" className="hover:text-slate-300">Refund Policy</Link>
        </div>
        <p className="text-xs text-slate-600">© {new Date().getFullYear()} Tempify</p>
      </div>
    </footer>
  );
}
