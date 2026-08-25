import type { ProfileType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Anyone who can sell paid tiers on Udala: Creators, Pairs, and Service
 * Providers. Kept separate from lib/providers.ts (which also imports
 * lib/payments) so client components can safely import this pure check —
 * e.g. via lib/creator.ts's formatCents — without pulling Stripe-dependent
 * server code into the browser bundle.
 */
export const PROVIDER_PROFILE_TYPES: readonly ProfileType[] = ["CREATOR", "PAIR", "SERVICE_PROVIDER"];

export function isProviderProfileType(profileType: ProfileType): boolean {
  return PROVIDER_PROFILE_TYPES.includes(profileType);
}

export async function getProviderProfile(providerId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: providerId } });
  if (!profile || !isProviderProfileType(profile.profileType)) return null;
  return profile;
}
