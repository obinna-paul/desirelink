import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Udala - Log in",
  description: "Log in to continue to Udala.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Log in to continue your conversations, plans, and creator access."
    >
      <LoginForm />
    </AuthShell>
  );
}
