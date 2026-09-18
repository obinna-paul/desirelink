import "server-only";

import { prisma } from "@/lib/prisma";

/** Settings' "What's your spec?" row offers a retake no more than once a month - enforced
 *  by app/api/spec-test/submit/route.ts, not just by disabling the button client-side, same
 *  as every other monthly cap in this codebase (e.g. Profile.earningsSummarySentForMonth).
 *  Anonymous submissions are never capped - only a signed-in taker has a profile row to check
 *  a prior submission against, and product direction (docs conversation, not written down
 *  elsewhere) is explicit: don't police an anonymous, untraceable retake at all. */
export const RETAKE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export type ActiveRetakeCooldown = {
  resultId: string;
  nextEligibleAt: Date;
};

/**
 * Null when this profile has no prior result, or its cooldown has already elapsed - either
 * way, nothing blocks a fresh submission for it. Shared by two callers that both need the
 * exact same answer to "is this profile blocked right now, and if so by which result":
 * submit/route.ts enforces it against a POST, and app/spec-test/quiz/page.tsx checks it before
 * rendering the quiz at all - a signed-in taker inside the cooldown gets sent straight to
 * their existing result instead of answering all 28 questions only to be told that at the end.
 */
export async function getActiveRetakeCooldown(
  profileId: string,
  instrumentVersion?: string,
): Promise<ActiveRetakeCooldown | null> {
  const lastResult = await prisma.specTestResult.findFirst({
    where: { profileId, instrumentVersion },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  if (!lastResult) return null;

  const nextEligibleAt = new Date(lastResult.createdAt.getTime() + RETAKE_COOLDOWN_MS);
  if (nextEligibleAt <= new Date()) return null;

  return { resultId: lastResult.id, nextEligibleAt };
}
