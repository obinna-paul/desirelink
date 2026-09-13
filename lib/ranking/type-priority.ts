import type { ProfileType } from "@prisma/client";

/** Which profile type a viewer of each type sees first, second, third - e.g. a seeker sees
 * other seekers before explorers before creators. A confirmed product decision, not a
 * formula derived from behavior like the other ranking terms that use it. Shared between
 * the "for you" post feed (lib/recommendation-scoring.ts, ranking post authors) and Discover
 * (lib/ranking/people-scoring.ts, ranking profiles directly) so both surfaces agree on the
 * same priority order. */
const TYPE_PRIORITY: Record<ProfileType, ProfileType[]> = {
  SEEKER: ["SEEKER", "EXPLORER", "CREATOR"],
  EXPLORER: ["CREATOR", "EXPLORER", "SEEKER"],
  CREATOR: ["EXPLORER", "CREATOR", "SEEKER"],
};

/** 1 for the viewer's top-priority type, 0.5 for the middle, 0 for the lowest - 0 for an
 * anonymous/typeless viewer, the same graceful-degradation shape as every other ranking
 * term in this codebase. */
export function typeTerm(viewerType: ProfileType | null, candidateType: ProfileType): number {
  if (!viewerType) return 0;
  const index = TYPE_PRIORITY[viewerType].indexOf(candidateType);
  return index === -1 ? 0 : 1 - index * 0.5;
}
