"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw, Send, ShieldCheck } from "lucide-react";

type ContactFields = {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

const initialFields = (subject: string): ContactFields => ({
  firstName: "",
  lastName: "",
  email: "",
  subject,
  message: "",
  website: "",
});

function capitalizeWords(value: string) {
  return value.replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

async function requestChallenge() {
  const response = await fetch("/api/contact", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load robot verification.");
  return data as { question: string; token: string };
}

export function ContactForm({ initialSubject = "" }: { initialSubject?: string }) {
  const [fields, setFields] = useState<ContactFields>(() => initialFields(initialSubject));
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [challengeQuestion, setChallengeQuestion] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadChallenge = useCallback(async () => {
    setChallengeLoading(true);
    setChallengeAnswer("");
    try {
      const data = await requestChallenge();
      setChallengeQuestion(data.question);
      setChallengeToken(data.token);
    } catch (challengeError) {
      setChallengeQuestion("");
      setChallengeToken("");
      setError(challengeError instanceof Error ? challengeError.message : "Unable to load robot verification.");
    } finally {
      setChallengeLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestChallenge()
      .then((data) => {
        if (!active) return;
        setChallengeQuestion(data.question);
        setChallengeToken(data.token);
      })
      .catch((challengeError) => {
        if (!active) return;
        setError(challengeError instanceof Error ? challengeError.message : "Unable to load robot verification.");
      })
      .finally(() => {
        if (active) setChallengeLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return fields.firstName.trim().length >= 2
      && fields.lastName.trim().length >= 2
      && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.trim())
      && fields.subject.trim().length >= 3
      && fields.message.trim().length >= 10
      && Boolean(challengeToken)
      && challengeAnswer.length > 0
      && acceptedPrivacy;
  }, [acceptedPrivacy, challengeAnswer, challengeToken, fields]);

  function updateField(field: keyof ContactFields, value: string) {
    const formatted = field === "firstName" || field === "lastName" ? capitalizeWords(value) : value;
    setFields((current) => ({ ...current, [field]: formatted }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!canSubmit) {
      setError("Complete all required fields, solve the verification question and accept the privacy notice.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          email: fields.email.trim().toLowerCase(),
          challengeToken,
          challengeAnswer: Number(challengeAnswer),
          acceptedPrivacy,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We could not send your message.");

      setSuccess(data.message || "Your message has been sent.");
      setFields(initialFields(initialSubject));
      setAcceptedPrivacy(false);
      await loadChallenge();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "We could not send your message.";
      setError(message);
      if (/verification|expired/i.test(message)) await loadChallenge();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="contact-form" onSubmit={submit} noValidate className="scroll-mt-28 rounded-2xl border border-orange-500/25 bg-[#0d1421]/96 p-5 shadow-2xl shadow-black/30 sm:p-7">
      <h2 className="text-2xl font-black text-white">Get in Touch</h2>
      <p className="mt-1 text-sm text-slate-400">We typically respond within 24 hours</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="sr-only">First name</span>
          <input className="field" autoComplete="given-name" maxLength={60} placeholder="First Name *" value={fields.firstName} onChange={(event) => updateField("firstName", event.target.value)} required />
        </label>
        <label>
          <span className="sr-only">Last name</span>
          <input className="field" autoComplete="family-name" maxLength={60} placeholder="Last Name *" value={fields.lastName} onChange={(event) => updateField("lastName", event.target.value)} required />
        </label>
        <label className="sm:col-span-2">
          <span className="sr-only">Email address</span>
          <input type="email" inputMode="email" className="field" autoComplete="email" maxLength={254} placeholder="Email Address *" value={fields.email} onChange={(event) => updateField("email", event.target.value)} required />
        </label>
        <label className="sm:col-span-2">
          <span className="sr-only">Subject</span>
          <input className="field" maxLength={120} placeholder="Subject *" value={fields.subject} onChange={(event) => updateField("subject", event.target.value)} required />
        </label>
        <label className="sm:col-span-2">
          <span className="sr-only">Your message</span>
          <textarea className="field min-h-36 resize-y py-3" maxLength={3000} placeholder="Your Message *" value={fields.message} onChange={(event) => updateField("message", event.target.value)} required />
          <span className="mt-1 block text-right text-[10px] text-slate-600">{fields.message.length}/3000</span>
        </label>
        <label className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={fields.website} onChange={(event) => updateField("website", event.target.value)} />
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-orange-500/20 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-extrabold text-white"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white shadow-lg shadow-orange-500/25"><ShieldCheck size={18} /></span> Robot Verification</div>
          <button type="button" onClick={() => void loadChallenge()} disabled={challengeLoading} aria-label="Get a new verification question" className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-orange-500/40 hover:text-orange-300 disabled:opacity-50"><RefreshCw size={15} className={challengeLoading ? "animate-spin" : ""} /></button>
        </div>
        <p className="mt-4 text-xs text-slate-400">Please solve this simple math problem to verify you&apos;re human:</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-white/10 bg-[#172233] px-4 py-3 text-sm font-extrabold text-white">{challengeLoading ? "Loading question…" : challengeQuestion || "Question unavailable"}</span>
          <span className="font-bold text-slate-500">=</span>
          <input aria-label="Robot verification answer" inputMode="numeric" pattern="[0-9]*" maxLength={2} className="field !w-24 text-center" placeholder="?" value={challengeAnswer} onChange={(event) => setChallengeAnswer(event.target.value.replace(/\D/g, "").slice(0, 2))} />
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-400">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500" checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)} />
        <span>I agree to the <Link href="/privacy-policy" className="font-bold text-orange-300 underline underline-offset-2">Privacy Policy</Link> and consent to the processing of my personal data for this support request. *</span>
      </label>

      {error && <div className="error-box mt-4" role="alert">{error}</div>}
      {success && <div className="success-box mt-4" role="status">{success}</div>}

      <button type="submit" disabled={!canSubmit || submitting || challengeLoading} className="btn-primary mt-4 w-full">
        {submitting ? <><LoaderCircle size={18} className="animate-spin" /> Sending Message</> : <>Send Message <Send size={16} /></>}
      </button>
    </form>
  );
}
