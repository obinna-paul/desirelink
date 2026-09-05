import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { absoluteUrl } from "@/lib/site-config";

/** Plain GET, not a fetch call - this is the link a person clicks straight from their
 * email client, so it has to work with no session and no JS. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profileId");
  const token = url.searchParams.get("token");

  if (!profileId || !token || !verifyUnsubscribeToken(profileId, token)) {
    return NextResponse.redirect(absoluteUrl("/unsubscribed?ok=0"));
  }

  await prisma.profile.updateMany({
    where: { id: profileId },
    data: { marketingEmailsEnabled: false },
  });

  return NextResponse.redirect(absoluteUrl("/unsubscribed?ok=1"));
}
