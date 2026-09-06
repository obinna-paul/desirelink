import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in securely to continue to your Udala account.",
  robots: PRIVATE_ROBOTS,
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Log in to continue your conversations, plans, and creator access."
      hideLogoIcon
      hideFooter
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
