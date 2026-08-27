import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ServiceListingInput } from "@/lib/validations/service-listing";

export async function getProviderServiceListings(providerId: string) {
  return prisma.serviceListing.findMany({
    where: { providerId },
    orderBy: { createdAt: "asc" },
  });
}

export type ServiceListingView = Awaited<ReturnType<typeof getProviderServiceListings>>[number];

const homeServiceListingInclude = {
  provider: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      city: true,
      country: true,
      isVerified: true,
      isVerifiedCreator: true,
      isTrustedMember: true,
    },
  },
} satisfies Prisma.ServiceListingInclude;

export type HomeServiceListingView = Prisma.ServiceListingGetPayload<{
  include: typeof homeServiceListingInclude;
}>;

export async function getHomeServiceListings(limit = 24): Promise<HomeServiceListingView[]> {
  return prisma.serviceListing.findMany({
    where: {
      provider: {
        profileType: "SERVICE_PROVIDER",
        isIncognito: false,
        isSuspended: false,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: homeServiceListingInclude,
  });
}

export async function createServiceListing(providerId: string, input: ServiceListingInput) {
  return prisma.serviceListing.create({ data: { providerId, ...input } });
}

export type ServiceListingActionResult = { ok: true } | { ok: false; status: number; error: string };

export async function updateServiceListing(
  id: string,
  providerId: string,
  input: ServiceListingInput
): Promise<ServiceListingActionResult> {
  const existing = await prisma.serviceListing.findUnique({ where: { id } });
  if (!existing || existing.providerId !== providerId) {
    return { ok: false, status: 404, error: "Service listing not found" };
  }

  await prisma.serviceListing.update({ where: { id }, data: input });
  return { ok: true };
}

export async function deleteServiceListing(id: string, providerId: string): Promise<ServiceListingActionResult> {
  const existing = await prisma.serviceListing.findUnique({ where: { id } });
  if (!existing || existing.providerId !== providerId) {
    return { ok: false, status: 404, error: "Service listing not found" };
  }

  await prisma.serviceListing.delete({ where: { id } });
  return { ok: true };
}
