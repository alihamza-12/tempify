"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Download, Home, LoaderCircle, MailCheck, TriangleAlert, UserRound } from "lucide-react";

type OrderState = {
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  paidAt: string | null;
  policyIssued: boolean;
  fulfillmentStatus: string;
  confirmationEmailRetryable: boolean;
  confirmationEmailStatus: "pending" | "sending" | "sent" | "failed";
  guideEmailRetryable: boolean;
  guideEmailStatus: "waiting" | "not_configured" | "pending" | "sending" | "sent" | "retrying" | "manual_review";
};

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
        if (
          !["paid", "failed", "cancelled", "expired"].includes(data.status) ||
          (data.status === "paid" && (data.confirmationEmailRetryable || data.guideEmailRetryable))
        ) timer = setTimeout(check, 3000);
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

  const emailSent = order.confirmationEmailStatus === "sent";
  const emailFailed = !emailSent && !order.confirmationEmailRetryable;
  const emailSummary = emailSent ? "Submitted to provider" : emailFailed ? "Needs attention" : "Processing";
  const emailMessage = emailSent
    ? `Your payment email was accepted by the email provider for ${email}. This does not confirm inbox delivery; please check your inbox and spam folder.`
    : emailFailed
      ? "Your payment is confirmed, but the payment email needs support attention. Do not pay again."
      : "Your payment is confirmed. The payment email is still being processed.";

  const guideSummary = order.guideEmailStatus === "sent"
    ? "Submitted to provider"
    : order.guideEmailStatus === "not_configured"
      ? "Not configured"
      : order.guideEmailStatus === "waiting"
        ? "Waiting for payment email"
        : order.guideEmailStatus === "sending" || order.guideEmailStatus === "retrying"
          ? "Processing / retrying"
          : order.guideEmailStatus === "manual_review"
            ? "Needs support attention"
            : "Pending";
  const guideMessage = order.guideEmailStatus === "sent"
    ? "The separate setup-guide email was accepted by the email provider. Check your inbox and spam folder."
    : order.guideEmailStatus === "not_configured"
      ? "The setup-guide sender is not configured on the server. Please contact support."
      : order.guideEmailStatus === "waiting"
        ? "The setup guide is sent only after the payment email is accepted."
        : order.guideEmailStatus === "manual_review"
          ? "The setup-guide email could not be completed automatically. Please contact support."
          : "The separate setup-guide email is being processed or will be retried automatically.";

  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: order.currency }).format(order.amount);
  return (
    <div className="panel overflow-hidden rounded-[28px]">
      <div className="brand-gradient px-6 py-10 text-center">
        <CheckCircle2 size={52} className="mx-auto" />
        <h1 className="mt-4 text-3xl font-black">Payment received</h1>
        <p className="mt-2 text-white/80">{emailMessage}</p>
      </div>
      <div className="space-y-5 p-5 sm:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary icon={MailCheck} label="Payment email" value={emailSummary} />
          <Summary icon={MailCheck} label="Setup guide" value={guideSummary} />
          <Summary icon={UserRound} label="Username" value={email} />
          <Summary icon={Clock3} label="Amount paid" value={money} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded-xl bg-[#111a29] p-4 text-sm leading-6 text-slate-300">{emailMessage}</p>
          <p className="rounded-xl bg-[#111a29] p-4 text-sm leading-6 text-slate-300">{guideMessage}</p>
        </div>

        {!order.policyIssued && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-sm leading-6 text-red-100">
            <strong className="block text-base text-red-300">No Cuvva policy or certificate has been issued, and no insurance cover is active.</strong>
            The attached Cuvva-format documents are unissued samples, not proof of insurance. Do not drive in reliance on this payment confirmation. Contact support about policy issuance.
          </div>
        )}

        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-100">
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
  return <div className="panel rounded-[28px] p-8 text-center"><div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${tone === "waiting" ? "bg-violet-500/15 text-violet-400" : "bg-red-500/15 text-red-400"}`}><Icon size={31} className={spinning ? "animate-spin" : ""} /></div><h1 className="mt-5 text-2xl font-black">{title}</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">{text}</p></div>;
}
function Summary({ icon: Icon, label, value }: { icon: typeof MailCheck; label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-[#111a29] p-4"><Icon size={18} className="text-violet-400" /><div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-extrabold">{value}</div></div>; }
