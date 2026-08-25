import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServiceListing, getProviderServiceListings } from "@/lib/service-listings";
import { serviceListingSchema } from "@/lib/validations/service-listing";

async function getServiceProviderProfile(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile?.profileType !== "SERVICE_PROVIDER") return null;
  return profile;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getServiceProviderProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Service provider access required" }, { status: 403 });
  }

  const listings = await getProviderServiceListings(profile.id);
  return NextResponse.json({ listings }, { status: 200 });
}

export async function POST(req: Request) {
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

  const listing = await createServiceListing(profile.id, parsed.data);
  return NextResponse.json({ listing }, { status: 201 });
}
