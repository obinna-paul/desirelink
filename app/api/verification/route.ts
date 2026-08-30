import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMyVerificationRequests, isVerificationRequestType, submitVerificationRequest } from "@/lib/verification";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const requests = await getMyVerificationRequests(profile.id);
  return NextResponse.json({ requests }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const requestType = body?.requestType;
  const govIdUrl = typeof body?.govIdUrl === "string" ? body.govIdUrl : "";
  const selfieUrl = typeof body?.selfieUrl === "string" ? body.selfieUrl : "";

  if (!isVerificationRequestType(requestType)) {
    return NextResponse.json({ error: "requestType must be 'creator', 'host', or 'service_provider'" }, { status: 400 });
  }

  const result = await submitVerificationRequest(profile.id, requestType, govIdUrl, selfieUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ requestId: result.requestId }, { status: 201 });
}
