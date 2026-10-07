"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Apple, ArrowLeft, CheckCircle2, CreditCard, LoaderCircle, LockKeyhole, Smartphone, Tag, UserRound } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";

type ReviewQuote = {
  publicId: string;
  vehicle: { registration: string; make: string; model: string; colour?: string; year?: number };
  cover: { durationUnit: string; durationValue: number; startAt: string; endAt: string };
  driver: { title: string; firstName: string; lastName: string; dateOfBirth: string; occupation: string; phone: string; email: string };
  address: { line1: string; line2?: string; city: string; postcode: string };
  licence: { number: string; type: string; heldFor: string; vehicleValue: string; reasonForCover: string };
  modifications: string[];
  pricing: { amount: number; currency: string };
};

export function ReviewClient({ quote }: { quote: ReviewQuote }) {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promo, setPromo] = useState("");
  const [promoMessage, setPromoMessage] = useState("");

  const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: quote.pricing.currency }).format(quote.pricing.amount);

  async function beginCheckout(skipSessionCheck = false) {
    setError("");
    setLoading(true);
    try {
      if (!skipSessionCheck) {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionData = await sessionResponse.json();
        if (!sessionData.user) {
          setAuthOpen(true);
          setLoading(false);
          return;
        }
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.publicId }),
      });
      const data = await response.json();
      if (response.status === 401) {
        setAuthOpen(true);
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Unable to start payment.");
      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start payment.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="panel rounded-[26px] p-5 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white"><CheckCircle2 size={29} /></div>
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">Review your details</h1>
          <p className="mt-2 text-sm text-slate-400">Check everything before continuing to secure payment</p>
        </div>

        <div className="mt-8 space-y-4">
          <ReviewSection icon={UserRound} title="Customer details">
            <ReviewRow label="Name" value={`${quote.driver.title} ${quote.driver.firstName} ${quote.driver.lastName}`} />
            <ReviewRow label="Date of birth" value={new Date(quote.driver.dateOfBirth).toLocaleDateString("en-GB")} />
            <ReviewRow label="Address" value={[quote.address.line1, quote.address.line2, quote.address.city, quote.address.postcode].filter(Boolean).join(", ")} />
            <ReviewRow label="Occupation" value={quote.driver.occupation} />
            <ReviewRow label="Email" value={quote.driver.email} />
          </ReviewSection>

          <ReviewSection icon={CreditCard} title="Vehicle & cover">
            <ReviewRow label="Vehicle" value={`${quote.vehicle.registration} · ${quote.vehicle.make} ${quote.vehicle.model}`} />
            <ReviewRow label="Start" value={new Date(quote.cover.startAt).toLocaleString("en-GB")} />
            <ReviewRow label="End" value={new Date(quote.cover.endAt).toLocaleString("en-GB")} />
            <ReviewRow label="Licence" value={`${quote.licence.type} · held ${quote.licence.heldFor.toLowerCase()}`} />
            <ReviewRow label="Reason" value={quote.licence.reasonForCover} />
          </ReviewSection>

          <div className="overflow-hidden rounded-2xl border border-orange-400/20 bg-gradient-to-br from-[#ef5a08] to-[#c93808] p-5 sm:p-6">
            <div className="flex items-center gap-2 font-extrabold"><CreditCard size={18} /> Total price</div>
            <div className="mt-5 rounded-xl bg-white/10 py-6 text-center text-4xl font-black sm:text-5xl">{money}</div>
            <div className="mt-4 rounded-xl border border-white/20 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold"><Tag size={16} /> Promo code</label>
              <div className="flex gap-2"><input value={promo} onChange={(e) => setPromo(e.target.value)} className="min-w-0 flex-1 rounded-lg border-0 bg-white px-3 text-sm text-slate-900 outline-none" placeholder="Promo code" /><button type="button" onClick={() => setPromoMessage(promo ? "This code is not currently active." : "Enter a promo code first.")} className="rounded-lg bg-white px-4 py-3 text-sm font-extrabold text-orange-600">Apply</button></div>
              {promoMessage && <p className="mt-2 text-xs text-white/80">{promoMessage}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#111a29] p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold"><LockKeyhole size={17} className="text-emerald-400" /> Secure hosted checkout</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Eligible payment methods are shown by PayMeGate for your order, device, region and amount.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <PaymentBadge icon={CreditCard} label="Card" />
              <PaymentBadge icon={Apple} label="Apple Pay" />
              <PaymentBadge icon={Smartphone} label="Google Pay" />
            </div>
          </div>
        </div>

        {error && <div className="error-box mt-5">{error}</div>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary"><ArrowLeft size={17} /> Change details</button>
          <button type="button" onClick={() => beginCheckout()} disabled={loading} className="btn-primary">{loading ? <><LoaderCircle size={18} className="animate-spin" /> Preparing checkout</> : <><CreditCard size={17} /> Proceed to payment</>}</button>
        </div>
      </div>

      <AuthModal open={authOpen} email={quote.driver.email} onClose={() => setAuthOpen(false)} onAuthenticated={() => { setAuthOpen(false); beginCheckout(true); }} />
    </>
  );
}

function ReviewSection({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-[#172233] p-4 sm:p-5"><h2 className="mb-3 flex items-center gap-2.5 font-extrabold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400"><Icon size={16} /></span>{title}</h2>{children}</section>;
}
function ReviewRow({ label, value }: { label: string; value: string }) { return <div className="flex flex-col gap-1 border-t border-white/8 py-3 text-sm first:border-0 sm:flex-row sm:items-start sm:justify-between"><span className="text-slate-500">{label}</span><span className="max-w-md text-left font-bold text-white sm:text-right">{value}</span></div>; }
function PaymentBadge({ icon: Icon, label }: { icon: typeof CreditCard; label: string }) { return <div className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[.025] text-center text-[11px] font-bold text-slate-300"><Icon size={18} className="text-orange-400" />{label}</div>; }
