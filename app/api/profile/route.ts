import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations/profile";
import { recalculateReputation } from "@/lib/reputation";
import { isPremiumUser, premiumLimitPayload } from "@/lib/premium";
import { readJson } from "@/lib/security/request";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(req);
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const currentProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!currentProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (parsed.data.isIncognito && !(await isPremiumUser(currentProfile.id))) {
    return NextResponse.json(
      premiumLimitPayload(
        "incognito",
        "Incognito mode is available with udala premium."
      ),
      { status: 402 }
    );
  }

  const { profileType, serviceCategories, ...rest } = parsed.data;

  const profile = await prisma.profile.update({
    where: { userId: session.user.id },
    data: {
      ...rest,
      profileType,
      serviceCategories: profileType === "SERVICE_PROVIDER" ? serviceCategories : [],
    },
  });

  const { score, isTrustedMember } = await recalculateReputation(profile.id);

  return NextResponse.json(
    { profile: { ...profile, communityStanding: score, isTrustedMember } },
    { status: 200 }
  );
}
