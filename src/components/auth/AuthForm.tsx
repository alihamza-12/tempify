"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, MailCheck } from "lucide-react";

type AuthUser = { id: string; email: string; fullName: string; role: string };

function capitalizeWords(value: string) {
  return value.replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

export function AuthForm({
  initialEmail = "",
  onAuthenticated,
}: {
  initialEmail?: string;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<"register" | "login" | "otp">("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/request-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: capitalizeWords(firstName.trim()),
            lastName: capitalizeWords(lastName.trim()),
            email: email.trim().toLowerCase(),
            password,
            acceptedTerms: accepted,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to send verification code.");
        setDevelopmentCode(data.developmentCode || "");
        setMessage(data.message);
        setMode("otp");
      } else if (mode === "otp") {
        const response = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to verify code.");
        onAuthenticated(data.user);
      } else {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to sign in.");
        onAuthenticated(data.user);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="brand-gradient mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-orange-500/20">
          {mode === "otp" ? <MailCheck size={25} /> : <LockKeyhole size={24} />}
        </div>
        <h2 className="mt-4 text-2xl font-black text-white">{mode === "register" ? "Create your account" : mode === "login" ? "Welcome back" : "Check your email"}</h2>
        <p className="mt-1.5 text-sm text-slate-400">{mode === "otp" ? `Enter the six-digit code sent to ${email}` : mode === "register" ? "Verify your email to continue to payment" : "Sign in to continue securely"}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">First name</span><input className="field" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(capitalizeWords(e.target.value))} required /></label>
            <label><span className="label">Last name</span><input className="field" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(capitalizeWords(e.target.value))} required /></label>
          </div>
        )}

        {mode !== "otp" && <label className="block"><span className="label">Email address</span><input type="email" inputMode="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>}
        {mode !== "otp" && (
          <div className="block">
            <label htmlFor="auth-password" className="label">Password</label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input id="auth-password" type={showPassword ? "text" : "password"} className="field !pl-11 !pr-12" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "register" ? 10 : 1} required />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/8 hover:text-orange-300" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {mode === "register" && <span className="mt-1.5 block text-[11px] text-slate-500">At least 10 characters with uppercase, lowercase and a number.</span>}
          </div>
        )}

        {mode === "register" && (
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-slate-400">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-orange-500" required />
            <span>I agree to the <a href="/terms-of-service" className="text-orange-400 underline">Terms of Service</a> and <a href="/privacy-policy" className="text-orange-400 underline">Privacy Policy</a>.</span>
          </label>
        )}

        {mode === "otp" && (
          <label className="block"><span className="label">Verification code</span><input inputMode="numeric" autoComplete="one-time-code" className="field text-center text-2xl font-black tracking-[.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required /></label>
        )}

        {message && <div className="success-box">{message}{developmentCode && <div className="mt-2 font-bold">Development code: {developmentCode}</div>}</div>}
        {error && <div className="error-box">{error}</div>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <LoaderCircle size={18} className="animate-spin" /> : mode === "register" ? <>Send verification code <ArrowRight size={17} /></> : mode === "otp" ? "Verify & create account" : "Sign in"}
        </button>
      </form>

      {mode !== "otp" && (
        <p className="mt-5 text-center text-sm text-slate-500">
          {mode === "register" ? "Already have an account?" : "New to Tempify?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setShowPassword(false); setError(""); }} className="font-bold text-orange-400 underline">{mode === "register" ? "Sign in" : "Create account"}</button>
        </p>
      )}
      {mode === "otp" && <button type="button" onClick={() => setMode("register")} className="mt-4 w-full text-center text-sm font-bold text-slate-400 underline">Use a different email</button>}
    </div>
  );
}
