import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createServiceListing,
  getProviderServiceListings,
} from "@/lib/service-listings";
import { serviceListingSchema } from "@/lib/validations/service-listing";
import { isProviderProfileType } from "@/lib/provider-types";
import { hasIdentityOnFile } from "@/lib/verification";

async function getCurrentProfile(userId: string) {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCurrentProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const listings = await getProviderServiceListings(profile.id);
  return NextResponse.json({ listings }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getCurrentProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.isSuspended) {
    return NextResponse.json(
      { error: "Your account is suspended from listing services" },
      { status: 403 },
    );
  }
  if (!isProviderProfileType(profile.profileType)) {
    return NextResponse.json(
      {
        error: "Switch to a creator account before listing services.",
        code: "PROVIDER_ACCOUNT_REQUIRED",
        actionHref: "/settings/account-type?intent=service",
      },
      { status: 403 },
    );
  }
  if (!(await hasIdentityOnFile(profile.id))) {
    return NextResponse.json(
      { error: "Verify your identity before listing a service." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = serviceListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const listing = await createServiceListing(profile.id, parsed.data);
  return NextResponse.json({ listing }, { status: 201 });
}
