import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a code by email to reset your Udala password.",
  robots: PRIVATE_ROBOTS,
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter the email on your account and we'll send you a code to reset it."
      hideLogoIcon
      hideFooter
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
