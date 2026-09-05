import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Udala - Set a new password",
  description: "Enter the code we emailed you along with your new password.",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      description="Enter the code we emailed you along with your new password."
      hideLogoIcon
      hideFooter
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
