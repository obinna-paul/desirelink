import type { ProfileType } from "@prisma/client";

import { isProviderProfileType } from "@/lib/provider-types";

export function getProfileCapabilityLabel({
  profileType,
  hostsEvents,
  offersServices,
}: {
  profileType: ProfileType;
  hostsEvents: boolean;
  offersServices: boolean;
}) {
  if (!isProviderProfileType(profileType)) return "Explorer";

  if (offersServices && !hostsEvents) return "Creator, services";
  if (hostsEvents && offersServices) return "Creator, host, services";
  if (hostsEvents) return "Creator & host";
  return "Creator";
}
