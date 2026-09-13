import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { GenderPickerForm } from "@/components/auth/gender-picker-form";
import { GENDER_UNSPECIFIED } from "@/lib/profile-options";

export default async function ChooseGenderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { gender: true },
  });
  if (!profile) redirect("/login");
  if (profile.gender !== GENDER_UNSPECIFIED) redirect("/");

  return (
    <AuthShell
      title="What's your gender?"
      description="This helps us show you to the right people, and helps you find who you're looking for."
    >
      <GenderPickerForm />
    </AuthShell>
  );
}
