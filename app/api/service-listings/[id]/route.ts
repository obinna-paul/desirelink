import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteServiceListing, updateServiceListing } from "@/lib/service-listings";
import { serviceListingSchema } from "@/lib/validations/service-listing";

async function getServiceProviderProfile(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile?.profileType !== "SERVICE_PROVIDER") return null;
  return profile;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getServiceProviderProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Service provider access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = serviceListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await updateServiceListing(params.id, profile.id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getServiceProviderProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Service provider access required" }, { status: 403 });
  }

  const result = await deleteServiceListing(params.id, profile.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
