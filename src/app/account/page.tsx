import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CarFront, ChevronRight, CircleUserRound, ReceiptText } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Order } from "@/models/Order";
import { User } from "@/models/User";
import { LogoutButton } from "@/components/auth/LogoutButton";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  await connectToDatabase();
  const [user, orders] = await Promise.all([
    User.findById(session.userId).select("fullName email createdAt").lean(),
    Order.find({ userId: session.userId }).sort({ createdAt: -1 }).limit(20).populate("quoteId").lean(),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="min-h-[calc(100vh-145px)] bg-[radial-gradient(circle_at_top,rgba(255,100,8,.13),transparent_25%),#07080b] py-12">
      <div className="container-shell max-w-4xl">
        <div className="panel flex flex-col gap-5 rounded-[26px] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400"><CircleUserRound size={28} /></div><div><p className="text-sm text-slate-500">Welcome back</p><h1 className="text-2xl font-black">{user.fullName}</h1><p className="mt-1 text-sm text-slate-400">{user.email}</p></div></div>
          <LogoutButton />
        </div>

        <div className="mt-6 flex items-center justify-between"><div><h2 className="text-xl font-black">Your orders</h2><p className="mt-1 text-sm text-slate-500">Payment and confirmation history</p></div><Link href="/#vehicle-search" className="btn-primary !min-h-10 !px-4 !text-sm"><CarFront size={16} /> New quote</Link></div>
        <div className="mt-5 space-y-3">
          {orders.length === 0 ? <div className="panel rounded-2xl p-10 text-center"><ReceiptText className="mx-auto text-slate-600" size={34} /><h3 className="mt-4 font-extrabold">No orders yet</h3><p className="mt-2 text-sm text-slate-500">Your completed and pending payments will appear here.</p></div> : orders.map((order) => {
            const quote = order.quoteId as unknown as { vehicle?: { registration?: string; make?: string; model?: string } };
            return <Link href={`/order/${order.publicId}`} key={String(order._id)} className="panel flex items-center justify-between gap-4 rounded-2xl p-5 transition hover:border-orange-500/30"><div><div className="font-extrabold">{quote?.vehicle?.registration || "Vehicle order"}</div><div className="mt-1 text-sm text-slate-500">{quote?.vehicle ? `${quote.vehicle.make || ""} ${quote.vehicle.model || ""}` : order.publicId}</div></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${order.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-orange-500/15 text-orange-400"}`}>{order.status}</span><ChevronRight size={18} className="text-slate-600" /></div></Link>;
          })}
        </div>
      </div>
    </div>
  );
}
