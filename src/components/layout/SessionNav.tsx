"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/auth-events";

type User = { fullName: string; email: string } | null;

export function SessionNav() {
  const [user, setUser] = useState<User>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });
        const data = response.ok ? await response.json() : { user: null };
        if (active) setUser(data.user || null);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoaded(true);
      }
    }

    const refreshSession = () => void loadSession();
    const refreshVisibleSession = () => {
      if (document.visibilityState === "visible") void loadSession();
    };

    void loadSession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
    window.addEventListener("focus", refreshSession);
    document.addEventListener("visibilitychange", refreshVisibleSession);

    return () => {
      active = false;
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession);
      window.removeEventListener("focus", refreshSession);
      document.removeEventListener("visibilitychange", refreshVisibleSession);
    };
  }, []);

  if (!loaded) return <div className="h-10 w-24 animate-pulse rounded-full bg-white/5" />;
  if (!user) {
    return (
      <Link href="/login" className="btn-primary !min-h-10 !rounded-full !px-5 !text-sm">
        Sign in
      </Link>
    );
  }

  return (
    <Link href="/account" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:border-orange-500/40">
      <UserRound size={16} className="text-orange-400" />
      <span className="hidden max-w-28 truncate sm:block">{user.fullName.split(" ")[0]}</span>
    </Link>
  );
}
