"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, MailCheck } from "lucide-react";

type AuthUser = { id: string; email: string; fullName: string; role: string };
type AuthMode = "register" | "login" | "otp";
type FieldName = "firstName" | "lastName" | "email" | "password" | "accepted" | "code";
type FieldErrors = Partial<Record<FieldName, string>>;

function capitalizeWords(value: string) {
  return value.replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

function validatePassword(value: string, mode: AuthMode) {
  if (!value) return "Enter your password.";
  if (mode !== "register") return "";
  if (value.length < 10) return "Use at least 10 characters.";
  if (value.length > 72) return "Use no more than 72 characters.";
  if (!/[A-Z]/.test(value)) return "Add at least one uppercase letter (A–Z).";
  if (!/[a-z]/.test(value)) return "Add at least one lowercase letter (a–z).";
  if (!/[0-9]/.test(value)) return "Add at least one number (0–9).";
  return "";
}

function passwordServerError(message: string) {
  return /uppercase|lowercase|include a number|at least 10 characters|no more than 72|password.*character/i.test(message);
}

export function AuthForm({
  initialEmail = "",
  onAuthenticated,
}: {
  initialEmail?: string;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");
  const [loading, setLoading] = useState(false);

  function setFieldError(field: FieldName, value: string) {
    setFieldErrors((current) => ({ ...current, [field]: value || undefined }));
  }

  function validateFields() {
    const next: FieldErrors = {};

    if (mode === "register") {
      if (firstName.trim().length < 2) next.firstName = "Enter at least 2 characters.";
      if (lastName.trim().length < 2) next.lastName = "Enter at least 2 characters.";
      if (!accepted) next.accepted = "Accept the Terms of Service and Privacy Policy to continue.";
    }

    if (mode !== "otp") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        next.email = "Enter a valid email address.";
      }
      const passwordMessage = validatePassword(password, mode);
      if (passwordMessage) next.password = passwordMessage;
    }

    if (mode === "otp" && !/^\d{6}$/.test(code)) {
      next.code = "Enter the complete 6-digit verification code.";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!validateFields()) return;

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
        setFieldErrors({});
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
      const submitMessage = submitError instanceof Error ? submitError.message : "Something went wrong.";
      if (mode === "register" && passwordServerError(submitMessage)) {
        setFieldError("password", submitMessage);
      } else {
        setError(submitMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: "register" | "login") {
    setMode(nextMode);
    setPassword("");
    setShowPassword(false);
    setFieldErrors({});
    setError("");
    setMessage("");
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

      <form onSubmit={submit} noValidate className="space-y-4">
        {mode === "register" && (
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">First name</span>
              <input className={`field ${fieldErrors.firstName ? "!border-red-400/70" : ""}`} autoComplete="given-name" value={firstName} onChange={(event) => { setFirstName(capitalizeWords(event.target.value)); setFieldError("firstName", ""); }} aria-invalid={Boolean(fieldErrors.firstName)} />
              <FieldError message={fieldErrors.firstName} />
            </label>
            <label>
              <span className="label">Last name</span>
              <input className={`field ${fieldErrors.lastName ? "!border-red-400/70" : ""}`} autoComplete="family-name" value={lastName} onChange={(event) => { setLastName(capitalizeWords(event.target.value)); setFieldError("lastName", ""); }} aria-invalid={Boolean(fieldErrors.lastName)} />
              <FieldError message={fieldErrors.lastName} />
            </label>
          </div>
        )}

        {mode !== "otp" && (
          <label className="block">
            <span className="label">Email address</span>
            <input type="email" inputMode="email" autoComplete="email" className={`field ${fieldErrors.email ? "!border-red-400/70" : ""}`} value={email} onChange={(event) => { setEmail(event.target.value); setFieldError("email", ""); }} aria-invalid={Boolean(fieldErrors.email)} />
            <FieldError message={fieldErrors.email} />
          </label>
        )}

        {mode !== "otp" && (
          <div className="block">
            <label htmlFor="auth-password" className="label">Password</label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" size={18} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${fieldErrors.password ? "text-red-400" : "text-slate-500"}`} />
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                className={`field !pl-11 !pr-12 ${fieldErrors.password ? "!border-red-400/70 !shadow-[0_0_0_3px_rgba(248,113,113,.10)]" : ""}`}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => {
                  const nextPassword = event.target.value;
                  setPassword(nextPassword);
                  if (fieldErrors.password) setFieldError("password", validatePassword(nextPassword, mode));
                }}
                onBlur={() => setFieldError("password", validatePassword(password, mode))}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby="auth-password-help"
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/8 hover:text-orange-300" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            <div id="auth-password-help">
              {fieldErrors.password
                ? <FieldError message={fieldErrors.password} />
                : mode === "register" && <span className="mt-1.5 block text-[11px] text-slate-500">Use 10–72 characters with an uppercase letter, lowercase letter and number.</span>}
            </div>
          </div>
        )}

        {mode === "register" && (
          <div>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-slate-400">
              <input type="checkbox" checked={accepted} onChange={(event) => { setAccepted(event.target.checked); setFieldError("accepted", ""); }} className="mt-1 h-4 w-4 accent-orange-500" />
              <span>I agree to the <a href="/terms-of-service" className="text-orange-400 underline">Terms of Service</a> and <a href="/privacy-policy" className="text-orange-400 underline">Privacy Policy</a>.</span>
            </label>
            <FieldError message={fieldErrors.accepted} />
          </div>
        )}

        {mode === "otp" && (
          <label className="block">
            <span className="label">Verification code</span>
            <input inputMode="numeric" autoComplete="one-time-code" className={`field text-center text-2xl font-black tracking-[.3em] ${fieldErrors.code ? "!border-red-400/70" : ""}`} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setFieldError("code", ""); }} placeholder="000000" aria-invalid={Boolean(fieldErrors.code)} />
            <FieldError message={fieldErrors.code} />
          </label>
        )}

        {message && <div className="success-box">{message}{developmentCode && <div className="mt-2 font-bold">Development code: {developmentCode}</div>}</div>}
        {error && <div className="error-box" role="alert">{error}</div>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <LoaderCircle size={18} className="animate-spin" /> : mode === "register" ? <>Send verification code <ArrowRight size={17} /></> : mode === "otp" ? "Verify & create account" : "Sign in"}
        </button>
      </form>

      {mode !== "otp" && (
        <p className="mt-5 text-center text-sm text-slate-500">
          {mode === "register" ? "Already have an account?" : "New to Tempify?"}{" "}
          <button type="button" onClick={() => switchMode(mode === "register" ? "login" : "register")} className="font-bold text-orange-400 underline">{mode === "register" ? "Sign in" : "Create account"}</button>
        </p>
      )}
      {mode === "otp" && <button type="button" onClick={() => { setMode("register"); setFieldErrors({}); setMessage(""); }} className="mt-4 w-full text-center text-sm font-bold text-slate-400 underline">Use a different email</button>}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold leading-5 text-red-400" role="alert"><CircleAlert size={14} className="mt-0.5 shrink-0" />{message}</span>;
}
