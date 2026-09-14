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
