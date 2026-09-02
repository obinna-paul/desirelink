import type { ProfileType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const CREATOR_PROFILE_TYPES: readonly ProfileType[] = ["CREATOR"];

export function isProviderProfileType(profileType: ProfileType): boolean {
  return profileType === "CREATOR";
}

export async function getProviderProfile(providerId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: providerId } });
  if (!profile || !isProviderProfileType(profile.profileType)) return null;
  return profile;
}
