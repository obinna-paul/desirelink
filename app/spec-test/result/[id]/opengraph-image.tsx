import { ImageResponse } from "next/og";

import { getSpecTestReading } from "@/lib/spec-test";
import type { ArchetypeKey } from "@/lib/spec-test/taxonomy";
import { absoluteUrl } from "@/lib/site-config";

/**
 * Per-result share card (docs/spec-test-v2-implementation-plan.md §11 "Share, email,
 * admin"). Deliberately headline-only, per the report's own instruction (§10): "Share card:
 * headline type only; private vulnerabilities never placed on the share image." No tagline
 * detail beyond the archetype's own one-liner, no blind spot, no dating loop, no lens scores.
 *
 * Runs on the default Node.js runtime (not edge) since getSpecTestReading goes through
 * Prisma, which this project doesn't configure for an edge driver.
 */

export const alt = "Your Spec on Udala";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dark, high-contrast pairing per archetype - independent of the result page's Tailwind
// accent classes, since ImageResponse (satori) only understands inline style values.
const ACCENT_COLORS: Record<ArchetypeKey, { bg: string; fg: string }> = {
  quiet_fire: { bg: "#450a0a", fg: "#fecaca" },
  soft_landing: { bg: "#4c0519", fg: "#fecdd3" },
  electric_charmer: { bg: "#4a044e", fg: "#f5d0fe" },
  ambitious_icon: { bg: "#451a03", fg: "#fde68a" },
  brilliant_tease: { bg: "#2e1065", fg: "#ddd6fe" },
  beautiful_mystery: { bg: "#1e1b4b", fg: "#c7d2fe" },
  free_spirit: { bg: "#431407", fg: "#fed7aa" },
  grounded_equal: { bg: "#042f2e", fg: "#99f6e4" },
};

const FALLBACK_ACCENT = ACCENT_COLORS.grounded_equal;

export default async function Image({ params }: { params: { id: string } }) {
  const reading = await getSpecTestReading(params.id);

  const name = reading ? (reading.version === "v1" ? reading.reading.name : reading.copy.headline.name) : "The Spec Test";
  const tagline = reading
    ? reading.version === "v1"
      ? reading.reading.tagline
      : reading.copy.headline.tagline
    : "Find out your spec on Udala.";
  const primarySpec: ArchetypeKey | null = reading ? (reading.version === "v1" ? reading.specType : reading.copy.primarySpec) : null;
  const accent = primarySpec ? ACCENT_COLORS[primarySpec] : FALLBACK_ACCENT;
  const host = new URL(absoluteUrl("/spec-test")).host + "/spec-test";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          backgroundColor: accent.bg,
          color: accent.fg,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", opacity: 0.75 }}>
          Udala &middot; The Spec Test
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, textTransform: "uppercase", letterSpacing: 4, opacity: 0.65 }}>
            Your spec is
          </div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.85, maxWidth: 940 }}>{tagline}</div>
        </div>

        <div style={{ display: "flex", fontSize: 26, opacity: 0.55 }}>{host}</div>
      </div>
    ),
    { ...size },
  );
}
