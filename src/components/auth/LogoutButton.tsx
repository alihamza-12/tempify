"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { notifyAuthSessionChanged } from "@/lib/auth-events";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        notifyAuthSessionChanged();
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut size={16} /> Sign out
    </button>
  );
}
