import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Enter the code we emailed you along with your new password.",
  robots: PRIVATE_ROBOTS,
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
