"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

export function PlateSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [registration, setRegistration] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleaned = registration.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length < 2) return setError("Enter your vehicle registration.");

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/vehicles/lookup?registration=${encodeURIComponent(cleaned)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Vehicle lookup failed.");
      router.push(`/quote?registration=${encodeURIComponent(data.vehicle.registration)}`);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Vehicle lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className={compact ? "w-full" : "panel rounded-[26px] p-5 sm:p-7"}>
      {!compact && (
        <div className="mb-5 text-center">
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">Find your vehicle</h2>
          <p className="mt-1.5 text-sm text-slate-400">Enter a UK registration to get started</p>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-orange-500/70 bg-[#111a2a] shadow-[0_0_0_1px_rgba(255,100,8,.1),0_18px_40px_rgba(255,91,0,.12)]">
        <div className="flex min-h-16 items-stretch">
          <div className="flex w-16 shrink-0 items-center justify-center bg-gradient-to-b from-orange-500 to-orange-600 text-sm font-black text-white">GB</div>
          <input
            value={registration}
            onChange={(event) => setRegistration(event.target.value.toUpperCase())}
            className="min-w-0 flex-1 bg-transparent px-4 text-xl font-black tracking-[.04em] text-white outline-none placeholder:text-slate-600 sm:text-2xl"
            placeholder="AB12 CDE"
            aria-label="Vehicle registration"
            autoComplete="off"
            maxLength={10}
          />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
        {loading ? <><LoaderCircle size={18} className="animate-spin" /> Verifying vehicle</> : <>Continue <ArrowRight size={18} /></>}
      </button>
      {error && <p className="error-box mt-3" role="alert">{error}</p>}
      {!compact && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
          <CheckCircle2 size={13} className="text-emerald-400" /> Provider-verified vehicle data only
        </p>
      )}
    </form>
  );
}
