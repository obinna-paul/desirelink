import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { UsernamePickerForm } from "@/components/auth/username-picker-form";

export default async function ChooseUsernamePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { username: true, usernameChosen: true },
  });
  if (!profile) redirect("/login");
  if (profile.usernameChosen) redirect("/");

  return (
    <AuthShell title="Choose your username" description="This is how people on udala will find and mention you.">
      <UsernamePickerForm suggestedUsername={profile.username} />
    </AuthShell>
  );
}
