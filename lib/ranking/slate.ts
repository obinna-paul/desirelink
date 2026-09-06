/**
 * Slate assembly from the discovery/ranking plan: pure, in-memory rules applied over two
 * already-sorted candidate pools (the main scored ranking and a separate exploration pool -
 * how that exploration pool is chosen is a retrieval-stage concern, out of scope here).
 * "Drop anything impressed recently" is deliberately NOT implemented here - per the plan's
 * architecture section that's an eligibility-stage SQL filter applied before candidates ever
 * reach scoring or assembly, so every candidate passed in is assumed already eligible.
 */

export type SlateCandidate = {
  id: string;
  authorId: string;
  score: number;
  isLocked: boolean;
  /** Whether the viewer has any CreatorAffinity toward this candidate's author. Only
   * meaningful when isLocked - a locked post from a creator the viewer has zero affinity
   * with is dropped outright, never placed, regardless of the locked quota below. Ignored
   * (and can be omitted) for unlocked candidates. */
  hasAffinity?: boolean;
};

export type SlatePolicy = {
  /** Window size the exploration quota and locked quota are each measured over. */
  slotsPerWindow: number;
  /** At most one post per creator within any window of this many consecutive slots. */
  creatorCapWindow: number;
  /** At most this many posts per creator across the whole slate. */
  maxPerCreatorPerSession: number;
  /** At least this many of every slotsPerWindow slots come from the exploration pool. */
  explorationSlotsPerWindow: number;
  /** At most this many locked posts in every slotsPerWindow slots. */
  maxLockedPerWindow: number;
};

export const DEFAULT_SLATE_POLICY: SlatePolicy = {
  slotsPerWindow: 10,
  creatorCapWindow: 5,
  maxPerCreatorPerSession: 3,
  explorationSlotsPerWindow: 2,
  maxLockedPerWindow: 2,
};

export type AssembleSlateInput = {
  /** The main scored pool, best candidate first. */
  ranked: SlateCandidate[];
  /** The exploration pool, best candidate first. Reserved slots (see explorationSlotsPerWindow
   * above) are filled from here first, falling back to the main pool when this runs out. */
  exploration: SlateCandidate[];
};

export type AssembleSlateOptions = {
  policy?: SlatePolicy;
  /** Caps the slate length. Defaults to consuming every eligible candidate. */
  targetLength?: number;
  /** Seeds the deterministic tiebreak for equal-score candidates - pass `${viewerId}:${sessionSeed}`
   * so repeated requests within one session return the same order, per the plan. */
  seed: string;
};

/** Deterministic pseudo-random hash of (seed, id) into [0, 1) - used only to break ties
 * between equal-score candidates in a way that's stable for a given seed but doesn't
 * systematically favor e.g. alphabetically-first ids. Exported for direct testing. */
export function seededTiebreak(seed: string, id: string): number {
  const combined = `${seed}:${id}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) | 0;
  }
  return (hash >>> 0) / 0xffffffff;
}

type Tagged = SlateCandidate & { fromExploration: boolean };

function sortWithTiebreak(candidates: SlateCandidate[], seed: string): SlateCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return seededTiebreak(seed, a.id) - seededTiebreak(seed, b.id);
  });
}

/**
 * Assembles a final slate from the two ranked pools, enforcing creator caps, the exploration
 * quota, and the locked-content quota. Locked candidates without any affinity toward their
 * creator are dropped before assembly even starts - the other rules never get a chance to
 * consider them.
 *
 * If no remaining candidate satisfies every constraint for a slot (queues aren't empty, but
 * everything left is blocked by a cap for right now), assembly stops there rather than
 * skipping ahead - a shorter slate is safer than an unbounded search, and it means a caller
 * seeing a short result should simply retrieve a larger candidate pool next time.
 */
export function assembleSlate(input: AssembleSlateInput, options: AssembleSlateOptions): SlateCandidate[] {
  const policy = options.policy ?? DEFAULT_SLATE_POLICY;
  const seed = options.seed;

  const eligible = (candidate: SlateCandidate) => !(candidate.isLocked && candidate.hasAffinity === false);

  const mainQueue: Tagged[] = sortWithTiebreak(input.ranked.filter(eligible), seed).map((candidate) => ({
    ...candidate,
    fromExploration: false,
  }));
  const explorationQueue: Tagged[] = sortWithTiebreak(input.exploration.filter(eligible), seed).map((candidate) => ({
    ...candidate,
    fromExploration: true,
  }));

  const targetLength = options.targetLength ?? mainQueue.length + explorationQueue.length;

  const result: Tagged[] = [];
  const seenIds = new Set<string>();
  const creatorSessionCount = new Map<string, number>();
  const recentCreators: string[] = [];

  function creatorAllowed(authorId: string): boolean {
    if ((creatorSessionCount.get(authorId) ?? 0) >= policy.maxPerCreatorPerSession) return false;
    const windowStart = Math.max(0, recentCreators.length - (policy.creatorCapWindow - 1));
    return !recentCreators.slice(windowStart).includes(authorId);
  }

  function lockedAllowedInBlock(blockStart: number): boolean {
    const lockedSoFar = result.slice(blockStart).filter((candidate) => candidate.isLocked).length;
    return lockedSoFar < policy.maxLockedPerWindow;
  }

  function takeNext(queue: Tagged[], blockStart: number): Tagged | null {
    for (let i = 0; i < queue.length; i++) {
      const candidate = queue[i];
      if (seenIds.has(candidate.id)) continue;
      if (!creatorAllowed(candidate.authorId)) continue;
      if (candidate.isLocked && !lockedAllowedInBlock(blockStart)) continue;
      queue.splice(i, 1);
      return candidate;
    }
    return null;
  }

  while (result.length < targetLength && (mainQueue.length > 0 || explorationQueue.length > 0)) {
    const slotInBlock = result.length % policy.slotsPerWindow;
    const blockStart = result.length - slotInBlock;
    const preferExploration = slotInBlock >= policy.slotsPerWindow - policy.explorationSlotsPerWindow;

    const primary = preferExploration ? explorationQueue : mainQueue;
    const secondary = preferExploration ? mainQueue : explorationQueue;

    const picked = takeNext(primary, blockStart) ?? takeNext(secondary, blockStart);
    if (!picked) break;

    result.push(picked);
    seenIds.add(picked.id);
    creatorSessionCount.set(picked.authorId, (creatorSessionCount.get(picked.authorId) ?? 0) + 1);
    recentCreators.push(picked.authorId);
  }

  return result.map((tagged) => ({
    id: tagged.id,
    authorId: tagged.authorId,
    score: tagged.score,
    isLocked: tagged.isLocked,
    hasAffinity: tagged.hasAffinity,
  }));
}
