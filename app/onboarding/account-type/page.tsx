import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { AccountTypePickerForm } from "@/components/auth/account-type-picker-form";

export default async function ChooseAccountTypePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { accountTypeChosen: true },
  });
  if (!profile) redirect("/login");
  if (profile.accountTypeChosen) redirect("/");

  return (
    <AuthShell
      title="How will you use udala?"
      description="Choose whether you're here to explore, find a relationship, or to create, host, or offer services."
    >
      <AccountTypePickerForm />
    </AuthShell>
  );
}
