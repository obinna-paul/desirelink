import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations/profile";
import { recalculateReputation } from "@/lib/reputation";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { accountType, isCreator, serviceCategories, ...rest } = parsed.data;

  const profile = await prisma.profile.update({
    where: { userId: session.user.id },
    data: {
      ...rest,
      accountType,
      isCreator: accountType === "creator" ? true : isCreator,
      isCouple: accountType === "pair",
      serviceCategories: accountType === "service_provider" ? serviceCategories : [],
    },
  });

  const { score, isTrustedMember } = await recalculateReputation(profile.id);

  return NextResponse.json(
    { profile: { ...profile, communityStanding: score, isTrustedMember } },
    { status: 200 }
  );
}
