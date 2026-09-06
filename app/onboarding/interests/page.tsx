import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { InterestsPickerForm } from "@/components/auth/interests-picker-form";
import { getAllTopics } from "@/lib/topics";

export default async function InterestsOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { interestsPromptShownAt: true },
  });
  if (!profile) redirect("/login");
  if (profile.interestsPromptShownAt) redirect("/");

  const topics = await getAllTopics();

  return (
    <AuthShell
      title="What are you into?"
      description="Pick a few interests so we can show you people and posts you'll actually like. You can change these anytime from Profile → Edit."
      hideFooter
    >
      <InterestsPickerForm topics={topics} />
    </AuthShell>
  );
}
