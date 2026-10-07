import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { Quote } from "@/models/Quote";
import { ReviewClient } from "@/components/quote/ReviewClient";

export const metadata: Metadata = { title: "Review your quote" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) notFound();
  await connectToDatabase();
  const quote = await Quote.findOne({ publicId: id, expiresAt: { $gt: new Date() } }).lean();
  if (!quote) notFound();

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
