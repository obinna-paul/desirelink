import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Lightweight, unauthenticated status poll for the public /live/[id] countdown page - lets a
 * visitor's browser notice the creator went live (or cancelled) without minting a LiveKit
 * token on every check. See components/live/live-schedule-countdown.tsx.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const stream = await prisma.liveStream.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!stream) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ status: stream.status });
}
