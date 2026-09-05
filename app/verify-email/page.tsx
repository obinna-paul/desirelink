import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Udala - Verify your email",
  description: "Enter the code we emailed you to finish setting up your Udala account.",
};

export default async function VerifyEmailPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user) redirect("/login");
  if (user.emailVerified) redirect("/profile/edit");

  return (
    <AuthShell
      title="Check your email"
      description={`We sent a 6-digit code to ${user.email}. Enter it below to finish setting up your account.`}
      hideLogoIcon
      hideFooter
    >
      <VerifyEmailForm />
    </AuthShell>
  );
}
