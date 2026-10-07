"use client";

import { X } from "lucide-react";
import { AuthForm } from "./AuthForm";

export function AuthModal({
  open,
  email,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  email?: string;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Sign in or create account">
      <div className="panel relative max-h-[calc(100vh-24px)] w-full max-w-md overflow-y-auto rounded-[26px] p-6 sm:p-8">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close"><X size={18} /></button>
        <AuthForm initialEmail={email} onAuthenticated={() => onAuthenticated()} />
      </div>
    </div>
  );
}
