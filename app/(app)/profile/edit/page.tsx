import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EditProfileForm } from "@/components/profile/edit-profile-form";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    redirect("/profile");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Profile" description="Update how others see you on DesireLink." />
      <EditProfileForm profile={profile} />
    </div>
  );
}
