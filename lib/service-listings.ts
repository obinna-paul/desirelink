import { prisma } from "@/lib/prisma";
import type { ServiceListingInput } from "@/lib/validations/service-listing";

export async function getProviderServiceListings(providerId: string) {
  return prisma.serviceListing.findMany({
    where: { providerId },
    orderBy: { createdAt: "asc" },
  });
}

export type ServiceListingView = Awaited<ReturnType<typeof getProviderServiceListings>>[number];

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
