import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseZap, Home, RefreshCw } from "lucide-react";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { ReviewClient } from "@/components/quote/ReviewClient";

export const metadata: Metadata = { title: "Review your quote" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) notFound();

  const result = await loadQuote(id);
  if (!result.ok) return <ReviewTemporarilyUnavailable id={id} />;
  if (!result.quote) notFound();
  const quote = result.quote;

  const serializable = {
    publicId: quote.publicId,
    vehicle: quote.vehicle,
    cover: { ...quote.cover, startAt: new Date(quote.cover.startAt).toISOString(), endAt: new Date(quote.cover.endAt).toISOString() },
    driver: { ...quote.driver, dateOfBirth: new Date(quote.driver.dateOfBirth).toISOString() },
    address: quote.address,
    licence: quote.licence,
    modifications: quote.modifications || [],
    pricing: quote.pricing,
  };

  return (
    <div className="min-h-[calc(100vh-145px)] bg-[radial-gradient(circle_at_top,rgba(255,100,8,.12),transparent_28%),#f5f6f8] px-3 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl"><ReviewClient quote={JSON.parse(JSON.stringify(serializable))} /></div>
    </div>
  );
}

async function loadQuote(publicId: string) {
  try {
    await connectToDatabase();
    const quote = await Quote.findOne({ publicId, expiresAt: { $gt: new Date() } }).lean();
    return { ok: true as const, quote };
  } catch (error) {
    console.error("[review] database unavailable", error);
    return { ok: false as const };
  }
}

function ReviewTemporarilyUnavailable({ id }: { id: string }) {
  return (
    <div className="min-h-[calc(100vh-145px)] bg-[radial-gradient(circle_at_top,rgba(255,100,8,.16),transparent_30%),#07080b] px-3 py-16">
      <div className="panel mx-auto max-w-lg rounded-[28px] p-6 text-center sm:p-9">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10 text-orange-400"><DatabaseZap size={29} /></span>
        <h1 className="mt-5 text-2xl font-black text-white sm:text-3xl">Your quote is temporarily unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">We could not reach the secure quote database. Your details have not been changed. Check the database connection and try again.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link href="/" className="btn-secondary"><Home size={17} /> Return home</Link>
          <a href={`/review?id=${encodeURIComponent(id)}`} className="btn-primary"><RefreshCw size={17} /> Try again</a>
        </div>
      </div>
    </div>
  );
}
