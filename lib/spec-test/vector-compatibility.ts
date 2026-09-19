// Client-safe. Matching uses only already-persisted Spec result summaries; raw answers,
// gender and assumed-attraction-target never enter this module.

import { normalizeMatchPriority, type MatchPriorityValue } from "@/lib/match-priority";
import { specCompatibilityWeight } from "@/lib/spec-test/compatibility";
import {
  ARCHETYPE_KEYS,
  LENS_KEYS,
  SCORING_DIMENSION_KEYS,
  type ArchetypeKey,
  type LensKey,
  type ScoringDimensionKey,
} from "@/lib/spec-test/taxonomy";

export type SpecVectorResult = {
  specType: string;
  secondarySpec?: string | null;
  sparkSpec?: string | null;
  partnershipSpec?: string | null;
  motiveScores?: unknown;
  lenses?: unknown;
  attachment?: unknown;
};

export type SpecCompatibilitySource = "vector" | "archetype" | "none";

export type SpecVectorCompatibility = {
  /** A boost in [0, 1]. Zero is neutral: Spec data never negatively ranks a profile. */
  score: number;
  /** How much of the priority-specific vector weighting was available on both results. */
  coverage: number;
  source: SpecCompatibilitySource;
  reason: string | null;
};

export type ReciprocalSpecCompatibility = SpecVectorCompatibility & {
  /** How strongly the candidate fits the viewer's selected priority. */
  forwardScore: number;
  /** How strongly the viewer fits the candidate's saved priority. */
  reverseScore: number;
};

type AttachmentVector = { anxiety: number; avoidance: number };

const DIMENSION_WEIGHTS: Record<MatchPriorityValue, Record<ScoringDimensionKey, number>> = {
  BALANCED: {
    warmthResponsiveness: 1,
    reliabilityReciprocity: 1,
    socialVitality: 1,
    agencyDirection: 1,
    cognitivePlay: 1,
    noveltyAutonomy: 1,
    containedDepthPrivacy: 1,
    aestheticSelectivity: 1,
  },
  SPARK: {
    warmthResponsiveness: 0.75,
    reliabilityReciprocity: 0.55,
    socialVitality: 1.5,
    agencyDirection: 1,
    cognitivePlay: 1.35,
    noveltyAutonomy: 1.5,
    containedDepthPrivacy: 1.15,
    aestheticSelectivity: 1.35,
  },
  PARTNERSHIP: {
    warmthResponsiveness: 1.5,
    reliabilityReciprocity: 1.6,
    socialVitality: 0.65,
    agencyDirection: 1.1,
    cognitivePlay: 1,
    noveltyAutonomy: 0.55,
    containedDepthPrivacy: 1,
    aestheticSelectivity: 0.75,
  },
};

const LENS_WEIGHTS: Record<MatchPriorityValue, Record<LensKey, number>> = {
  BALANCED: {
    sparkSafety: 1,
    closenessAutonomy: 1,
    fastSlow: 1,
    directnessIntrigue: 1,
    privatePublic: 1,
    admirationMutuality: 1,
    mindEmbodied: 1,
    explorationCommitment: 1,
  },
  SPARK: {
    sparkSafety: 1.5,
    closenessAutonomy: 0.75,
    fastSlow: 1.4,
    directnessIntrigue: 1.25,
    privatePublic: 0.8,
    admirationMutuality: 0.9,
    mindEmbodied: 1.2,
    explorationCommitment: 1.2,
  },
  PARTNERSHIP: {
    sparkSafety: 0.8,
    closenessAutonomy: 1.3,
    fastSlow: 1.1,
    directnessIntrigue: 1,
    privatePublic: 0.9,
    admirationMutuality: 1.2,
    mindEmbodied: 0.9,
    explorationCommitment: 1.5,
  },
};

// Lenses are derived partly from the attraction dimensions in the current instruments, so
// they deliberately receive less weight than the source dimensions. Attachment remains a
// modest contextual signal: it describes reactions under uncertainty, not a diagnosis.
const COMPONENT_WEIGHTS: Record<MatchPriorityValue, { dimensions: number; lenses: number; attachment: number }> = {
  BALANCED: { dimensions: 0.62, lenses: 0.28, attachment: 0.1 },
  SPARK: { dimensions: 0.72, lenses: 0.25, attachment: 0.03 },
  PARTNERSHIP: { dimensions: 0.48, lenses: 0.35, attachment: 0.17 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scoreValue(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function completeVector<K extends string>(
  keys: readonly K[],
  valueFor: (key: K) => number | null,
): Record<K, number> | null {
  const entries: [K, number][] = [];
  for (const key of keys) {
    const value = valueFor(key);
    if (value === null) return null;
    entries.push([key, value]);
  }
  return Object.fromEntries(entries) as Record<K, number>;
}

/** Reconstructs the engine's eight dimensions without using the combined intrigue score,
 * which is only the mean of the two separately stored facets. */
export function readScoringVector(result: SpecVectorResult | undefined): Record<ScoringDimensionKey, number> | null {
  if (!result || !isRecord(result.motiveScores)) return null;
  const container = result.motiveScores;
  // Support the canonical { motives, facets } shape and the early plain-motives shape.
  const motives = isRecord(container.motives) ? container.motives : container;
  const facets = isRecord(container.facets) ? container.facets : container;

  return completeVector(SCORING_DIMENSION_KEYS, (key) =>
    key === "containedDepthPrivacy" || key === "aestheticSelectivity"
      ? scoreValue(facets, key)
      : scoreValue(motives, key),
  );
}

export function readLensVector(result: SpecVectorResult | undefined): Record<LensKey, number> | null {
  if (!result || !isRecord(result.lenses)) return null;
  return completeVector(LENS_KEYS, (key) => scoreValue(result.lenses as Record<string, unknown>, key));
}

export function readAttachmentVector(result: SpecVectorResult | undefined): AttachmentVector | null {
  if (!result || !isRecord(result.attachment)) return null;
  const anxiety = scoreValue(result.attachment, "anxiety");
  const avoidance = scoreValue(result.attachment, "avoidance");
  return anxiety === null || avoidance === null ? null : { anxiety, avoidance };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Converts weighted mean absolute distance into a conservative boost. Profiles more than
 * 60 points apart on average receive no Spec boost; identical vectors receive the full one. */
function weightedSimilarity<K extends string>(
  left: Record<K, number>,
  right: Record<K, number>,
  keys: readonly K[],
  weights: Record<K, number>,
): number {
  let weightedDistance = 0;
  let totalWeight = 0;
  for (const key of keys) {
    weightedDistance += Math.abs(left[key] - right[key]) * weights[key];
    totalWeight += weights[key];
  }
  return totalWeight > 0 ? clamp01(1 - weightedDistance / totalWeight / 60) : 0;
}

function attachmentSimilarity(left: AttachmentVector, right: AttachmentVector): number {
  const meanDistance = (Math.abs(left.anxiety - right.anxiety) + Math.abs(left.avoidance - right.avoidance)) / 2;
  return clamp01(1 - meanDistance / 60);
}

function validArchetype(value: string | null | undefined): ArchetypeKey | null {
  return ARCHETYPE_KEYS.includes(value as ArchetypeKey) ? (value as ArchetypeKey) : null;
}

function selectedViewerArchetype(result: SpecVectorResult, priority: MatchPriorityValue): ArchetypeKey | null {
  if (priority === "SPARK") return validArchetype(result.sparkSpec ?? result.specType);
  if (priority === "PARTNERSHIP") return validArchetype(result.partnershipSpec ?? result.specType);
  return validArchetype(result.specType);
}

function vectorReason(priority: MatchPriorityValue): string {
  if (priority === "SPARK") return "Your chemistry preferences align";
  if (priority === "PARTNERSHIP") return "Your relationship rhythms align";
  return "Your Spec profiles align";
}

/**
 * Compares two Spec profiles as alignment between their attraction preferences and
 * relationship rhythms. It does not claim either person possesses the traits the other
 * prefers. Components missing on either side are omitted and the remaining weights are
 * renormalized; if no vector component survives, legacy archetype matching is used.
 */
export function scoreSpecVectorCompatibility(
  viewerResults: SpecVectorResult[],
  candidateResults: SpecVectorResult[],
  priority: MatchPriorityValue = "BALANCED",
): SpecVectorCompatibility {
  const viewer = viewerResults[0];
  const candidate = candidateResults[0];
  if (!viewer || !candidate) return { score: 0, coverage: 0, source: "none", reason: null };

  const componentWeights = COMPONENT_WEIGHTS[priority];
  const components: { score: number; weight: number }[] = [];

  const viewerDimensions = readScoringVector(viewer);
  const candidateDimensions = readScoringVector(candidate);
  if (viewerDimensions && candidateDimensions) {
    components.push({
      score: weightedSimilarity(
        viewerDimensions,
        candidateDimensions,
        SCORING_DIMENSION_KEYS,
        DIMENSION_WEIGHTS[priority],
      ),
      weight: componentWeights.dimensions,
    });
  }

  const viewerLenses = readLensVector(viewer);
  const candidateLenses = readLensVector(candidate);
  if (viewerLenses && candidateLenses) {
    components.push({
      score: weightedSimilarity(viewerLenses, candidateLenses, LENS_KEYS, LENS_WEIGHTS[priority]),
      weight: componentWeights.lenses,
    });
  }

  const viewerAttachment = readAttachmentVector(viewer);
  const candidateAttachment = readAttachmentVector(candidate);
  if (viewerAttachment && candidateAttachment) {
    components.push({
      score: attachmentSimilarity(viewerAttachment, candidateAttachment),
      weight: componentWeights.attachment,
    });
  }

  const availableWeight = components.reduce((sum, component) => sum + component.weight, 0);
  if (availableWeight > 0) {
    const score = components.reduce((sum, component) => sum + component.score * component.weight, 0) / availableWeight;
    return {
      score: clamp01(score),
      coverage: clamp01(availableWeight),
      source: "vector",
      reason: score >= 0.5 ? vectorReason(priority) : null,
    };
  }

  const score = specCompatibilityWeight(
    selectedViewerArchetype(viewer, priority),
    validArchetype(candidate.specType),
  );
  return {
    score,
    coverage: 0,
    source: score > 0 ? "archetype" : "none",
    reason: null,
  };
}

/**
 * Rewards two-way fit without making a sparse legacy signal all-or-nothing. The geometric
 * mean is the dominant term, so a high score requires strength in both directions; the
 * smaller arithmetic-mean term preserves a modest discovery boost for a one-way signal.
 */
export function combineReciprocalScores(forwardScore: number, reverseScore: number): number {
  const forward = clamp01(forwardScore);
  const reverse = clamp01(reverseScore);
  const arithmeticMean = (forward + reverse) / 2;
  const geometricMean = Math.sqrt(forward * reverse);
  return clamp01(0.35 * arithmeticMean + 0.65 * geometricMean);
}

/**
 * Scores both directions using each person's own priority, then combines them into one
 * reciprocal boost. This remains a preference-alignment score, not a prediction that either
 * person will like, reply to, or consent to contact from the other.
 */
export function scoreReciprocalSpecCompatibility(
  viewerResults: SpecVectorResult[],
  candidateResults: SpecVectorResult[],
  viewerPriority: MatchPriorityValue = "BALANCED",
  candidatePriority: MatchPriorityValue = "BALANCED",
): ReciprocalSpecCompatibility {
  const forward = scoreSpecVectorCompatibility(
    viewerResults,
    candidateResults,
    normalizeMatchPriority(viewerPriority),
  );
  const reverse = scoreSpecVectorCompatibility(
    candidateResults,
    viewerResults,
    normalizeMatchPriority(candidatePriority),
  );
  const score = combineReciprocalScores(forward.score, reverse.score);
  const source: SpecCompatibilitySource =
    forward.source === "vector" || reverse.source === "vector"
      ? "vector"
      : forward.source === "archetype" || reverse.source === "archetype"
        ? "archetype"
        : "none";

  let reason: string | null = null;
  if (source === "vector" && score >= 0.5) {
    reason = "Your Spec preferences align both ways";
  } else if (
    source === "archetype" &&
    viewerResults[0]?.specType === candidateResults[0]?.specType &&
    score >= 0.3
  ) {
    reason = "Shares your spec";
  } else if (source === "archetype" && score >= 0.5) {
    reason = "Your Specs complement each other";
  }

  return {
    score,
    coverage: (forward.coverage + reverse.coverage) / 2,
    source,
    reason,
    forwardScore: forward.score,
    reverseScore: reverse.score,
  };
}
