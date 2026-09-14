import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/layout/back-link";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";

export default async function SecuritySettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, profile: { select: { username: true } } },
  });
  if (!user?.profile) {
    redirect("/login");
  }

  const hasPassword = Boolean(user.passwordHash);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <BackLink />

      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your password and account.</p>
      </div>

      <ChangePasswordForm hasPassword={hasPassword} />
      <DeleteAccountSection username={user.profile.username} hasPassword={hasPassword} />
    </div>
  );
}
