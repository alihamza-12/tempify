import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/account");
  return (
    <div className="min-h-[calc(100vh-145px)] bg-[radial-gradient(circle_at_top,rgba(255,100,8,.18),transparent_38%),#07080b] px-3 py-14">
      <div className="panel mx-auto w-full max-w-md rounded-[28px] p-6 sm:p-8">
        <LoginScreen />
      </div>
    </div>
  );
}
