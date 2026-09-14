// Deliberately NOT server-only, unlike lib/spec-test/interpretation/readings-v2.ts and
// legacy.ts (which hold the full narrative content and are gated to server-side rendering).
// This is just the 8 display names, safe to import from a client component - specifically
// components/home/profile-card.tsx, which is used inside components/discover/
// discover-infinite-grid.tsx's client-side "load more" and needs a name to render the
// public spec badge without pulling the interpretation layer into the client bundle.

import type { ArchetypeKey } from "@/lib/spec-test/taxonomy";

export const ARCHETYPE_DISPLAY_NAMES: Record<ArchetypeKey, string> = {
  quiet_fire: "Quiet Fire",
  soft_landing: "Soft Landing",
  electric_charmer: "Electric Charmer",
  ambitious_icon: "Ambitious Icon",
  brilliant_tease: "Brilliant Tease",
  beautiful_mystery: "Beautiful Mystery",
  free_spirit: "Free Spirit",
  grounded_equal: "Grounded Equal",
};

/** `SpecTestResult.specType` is a plain string shared by v1 and v2 rows - this narrows it
 *  back to a known key, or null for anything else (a v1-only key that predates the current
 *  archetype set, or a corrupt value), so a caller never has to trust raw DB text as a type. */
export function archetypeDisplayName(specType: string | null | undefined): string | null {
  if (!specType || !(specType in ARCHETYPE_DISPLAY_NAMES)) return null;
  return ARCHETYPE_DISPLAY_NAMES[specType as ArchetypeKey];
}

/**
 * A one-glance summary of each archetype, for the "My spec is X" badge's info popup
 * (components/spec-test/spec-badge.tsx) - so a viewer can judge fit without taking the test
 * themselves. Deliberately new, short, third-person copy rather than a reuse of
 * lib/spec-test/legacy.ts's SPEC_TYPE_READINGS: that file is `server-only` and its prose
 * addresses the test-taker directly ("You're attracted to..."), which reads as if it's
 * describing the viewer rather than the profile owner when shown on someone else's badge.
 */
export const ARCHETYPE_SUMMARIES: Record<ArchetypeKey, string> = {
  quiet_fire:
    "Composed, private, and quietly intense. Doesn't need to compete for attention, and reveals depth gradually rather than all at once.",
  soft_landing:
    "Affectionate, emotionally available, and reassuring. The kind of presence that puts people at ease, with genuine warmth behind it.",
  electric_charmer:
    "Bold, playful, and hard to ignore. Brings energy into a room and thrives on banter, spontaneity, and real chemistry.",
  ambitious_icon:
    "Polished, driven, and visibly going somewhere. Values effort and direction, and is usually building toward something bigger.",
  brilliant_tease:
    "Sharp, witty, and mentally stimulating. Connection starts in conversation, through humor, curiosity, and being genuinely understood.",
  beautiful_mystery:
    "Stylish, selective, and a little hard to read. Reveals themselves gradually, with layers worth discovering rather than everything upfront.",
  free_spirit:
    "Expressive, adventurous, and resistant to routine. Values freedom and spontaneity, and treats connection like an adventure, not an obligation.",
  grounded_equal:
    "Dependable, values-driven, and comfortable being themselves. Prioritizes real compatibility and consistency over grand gestures.",
};

export function archetypeSummary(specType: string | null | undefined): string | null {
  if (!specType || !(specType in ARCHETYPE_SUMMARIES)) return null;
  return ARCHETYPE_SUMMARIES[specType as ArchetypeKey];
}
