import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { OrderStatus } from "@/components/quote/OrderStatus";

export const metadata: Metadata = { title: "Payment status" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(`/order/${id}`)}`);

  return (
    <div className="min-h-[calc(100vh-145px)] bg-[radial-gradient(circle_at_top,rgba(255,100,8,.16),transparent_32%),#07080b] px-3 py-12">
      <div className="mx-auto max-w-3xl"><OrderStatus id={id} email={session.email} /></div>
    </div>
  );
}
