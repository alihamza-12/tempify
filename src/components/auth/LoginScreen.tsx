"use client";

import { useRouter } from "next/navigation";
import { AuthForm } from "./AuthForm";

export function LoginScreen() {
  const router = useRouter();
  return <AuthForm onAuthenticated={() => { router.push("/account"); router.refresh(); }} />;
}
