import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { AddEmailForm } from "@/components/auth/add-email-form";

export default async function AddEmailOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { emailChosen: true },
  });
  if (!profile) redirect("/login");
  if (profile.emailChosen) redirect("/");

  return (
    <AuthShell
      title="Add your email"
      description="X doesn't share an email address with us, so add one here — it's how you'll log in from another device, get notified, and recover your account."
      hideLogoIcon
    >
      <AddEmailForm />
    </AuthShell>
  );
}
