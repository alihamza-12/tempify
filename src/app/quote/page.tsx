import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { QuoteForm } from "@/components/quote/QuoteForm";

export const metadata: Metadata = { title: "Get your quote" };

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ registration?: string }> }) {
  const { registration = "" } = await searchParams;
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,100,8,.10),transparent_25%),#f5f6f8] py-10 text-[#101727] sm:py-14">
      <div className="mx-auto w-[min(760px,calc(100%-24px))]">
        <div className="mb-4 flex items-center gap-4 rounded-[22px] bg-[#3f4655] px-5 py-5 text-white shadow-xl sm:px-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500"><FileText size={21} /></div>
          <div><h1 className="text-xl font-black sm:text-2xl">Get your quote</h1><p className="mt-1 text-sm text-slate-300">Complete the form for an instant price</p></div>
        </div>
        <QuoteForm registration={registration} />
      </div>
    </div>
  );
}
