/**
 * Canonical production URL for building absolute links (Open Graph, JSON-LD, sitemap).
 * Falls back to NEXTAUTH_URL (already required to be correct in every deployment for
 * OAuth callbacks to work) before the known production domain, so this never needs its
 * own separately-configured env var to stay correct.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "https://udala-seven.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "udala";
export const DEFAULT_OG_IMAGE = "/og-image.png";
export const DEFAULT_DESCRIPTION =
  "udala is a real-time social marketplace for creators and explorers - live streams, events, services, and a feed built for genuine connection.";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
