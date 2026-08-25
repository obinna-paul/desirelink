import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { setMonetizationSuspended } from "@/lib/monetization";

export async function PATCH(req: Request, { params }: { params: { profileId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action !== "suspend" && action !== "reinstate") {
    return NextResponse.json({ error: "action must be 'suspend' or 'reinstate'" }, { status: 400 });
  }

  const result = await setMonetizationSuspended(params.profileId, action === "suspend");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
