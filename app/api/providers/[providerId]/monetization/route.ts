import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyForMonetization, getMonetizationEligibility } from "@/lib/monetization";

async function requireOwner(req: Request, providerId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const viewerProfile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (viewerProfile?.id !== providerId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "You can only manage your own monetization status" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function GET(req: Request, { params }: { params: { providerId: string } }) {
  const auth = await requireOwner(req, params.providerId);
  if (!auth.ok) return auth.response;

  const eligibility = await getMonetizationEligibility(params.providerId);
  if (!eligibility) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  return NextResponse.json({ eligibility }, { status: 200 });
}

export async function POST(req: Request, { params }: { params: { providerId: string } }) {
  const auth = await requireOwner(req, params.providerId);
  if (!auth.ok) return auth.response;

  const result = await applyForMonetization(params.providerId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, requirements: result.requirements }, { status: result.status });
  }

  return NextResponse.json({ eligibility: result.eligibility }, { status: 200 });
}
