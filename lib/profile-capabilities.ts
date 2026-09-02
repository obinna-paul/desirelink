import type { ProfileType } from "@prisma/client";

import { isProviderProfileType } from "@/lib/provider-types";

export function getProfileCapabilityLabel({
  profileType,
  offersServices,
}: {
  profileType: ProfileType;
  offersServices: boolean;
}) {
  if (!isProviderProfileType(profileType)) return "Explorer";

  if (offersServices) return "Creator, services";
  return "Creator";
}
