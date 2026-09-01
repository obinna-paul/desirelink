"use client";

import { usePathname } from "next/navigation";

import { ProfileSetupActions, type SetupProfile } from "@/components/profile/profile-setup-actions";

/** Quick actions belongs to the home feed, not every page in the app — it fully unmounts
 * (rather than just hiding) so it also drops its live data subscription off other pages. */
export function HomeOnlyQuickActions({ profile }: { profile: SetupProfile }) {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <ProfileSetupActions profile={profile} />;
}
