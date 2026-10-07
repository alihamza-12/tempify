"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Download, Home, LoaderCircle, MailCheck, Smartphone, TriangleAlert, UserRound } from "lucide-react";

type OrderState = { orderId: string; status: string; amount: number; currency: string; paidAt: string | null };

export function OrderStatus({ id, email }: { id: string; email: string }) {
  const [order, setOrder] = useState<OrderState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load payment status.");
        if (!active) return;
        setOrder(data);
        if (!["paid", "failed", "cancelled", "expired"].includes(data.status)) timer = setTimeout(check, 3000);
      } catch (checkError) {
        if (active) setError(checkError instanceof Error ? checkError.message : "Unable to load payment status.");
      }
    }
    check();
    return () => { active = false; clearTimeout(timer); };
  }, [id]);

  if (error) return <StateCard icon={TriangleAlert} title="We couldn’t check your payment" text={error} tone="error" />;
  if (!order || order.status === "unpaid") return <StateCard icon={LoaderCircle} spinning title="Confirming your payment" text="Please keep this page open. We’re securely checking the payment provider for confirmation." tone="waiting" />;
  if (order.status !== "paid") return <StateCard icon={TriangleAlert} title={`Payment ${order.status}`} text="No fulfillment has been issued. You can return to your account or contact support if you think this is incorrect." tone="error" />;

  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: order.currency }).format(order.amount);
  return (
    <div className="panel overflow-hidden rounded-[28px]">
      <div className="brand-gradient px-6 py-10 text-center">
        <CheckCircle2 size={52} className="mx-auto" />
        <h1 className="mt-4 text-3xl font-black">Payment confirmed</h1>
        <p className="mt-2 text-white/80">Your confirmation has been sent to {email}</p>
      </div>
      <div className="space-y-5 p-5 sm:p-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary icon={MailCheck} label="Email" value="Confirmation sent" />
          <Summary icon={UserRound} label="Username" value={email} />
          <Summary icon={Clock3} label="Amount paid" value={money} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#172233] p-5">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><Smartphone size={19} className="text-orange-400" /> Add Tempify to your home screen</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InstallBlock title="On iPhone or iPad" steps={["Open this page in Safari", "Tap the Share button", "Choose Add to Home Screen", "Tap Add"]} />
            <InstallBlock title="On Android" steps={["Open this page in Chrome", "Tap the browser menu", "Choose Add to Home screen", "Confirm Install"]} />
          </div>
        </div>

        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/8 p-4 text-sm leading-6 text-orange-100">
          Your username is your email address. Use the password you created during verification—passwords are never displayed or emailed for security.
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/account" className="btn-primary"><Download size={17} /> View account</Link>
          <Link href="/" className="btn-secondary"><Home size={17} /> Back to home</Link>
        </div>
      </div>
    </div>
  );
}

function StateCard({ icon: Icon, title, text, tone, spinning = false }: { icon: typeof Clock3; title: string; text: string; tone: "waiting" | "error"; spinning?: boolean }) {
  return <div className="panel rounded-[28px] p-8 text-center"><div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${tone === "waiting" ? "bg-orange-500/15 text-orange-400" : "bg-red-500/15 text-red-400"}`}><Icon size={31} className={spinning ? "animate-spin" : ""} /></div><h1 className="mt-5 text-2xl font-black">{title}</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">{text}</p></div>;
}
function Summary({ icon: Icon, label, value }: { icon: typeof MailCheck; label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-[#111a29] p-4"><Icon size={18} className="text-orange-400" /><div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-extrabold">{value}</div></div>; }
function InstallBlock({ title, steps }: { title: string; steps: string[] }) { return <div className="rounded-xl bg-[#111a29] p-4"><h3 className="font-extrabold">{title}</h3><ol className="mt-3 space-y-2 text-sm text-slate-400">{steps.map((step, index) => <li key={step} className="flex gap-2"><span className="font-bold text-orange-400">{index + 1}.</span>{step}</li>)}</ol></div>; }
