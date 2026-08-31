import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";

import { PreferencesEditor } from "@/components/preferences/preferences-editor";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditPreferencesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { desires: { orderBy: { createdAt: "asc" } } },
  });
  if (!profile) redirect("/profile");

  return (
    <div className="mx-auto w-full max-w-3xl px-1 pb-8 sm:px-0">
      <Link
        href="/profile/edit"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Edit profile
      </Link>
      <PreferencesEditor
        initialPreferences={profile.desires}
        redirectTo="/profile"
        submitLabel="Save preferences"
      />
    </div>
  );
}
