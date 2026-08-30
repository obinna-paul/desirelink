/**
 * Pure hearts-economy data shared between the server (lib/hearts.ts) and the
 * client (buy-hearts UI, gift picker) — no server-only imports here.
 */

/** 1 heart = 1 cent of real money, before the platform's revenue-share cut on gifts (see GIFT_PROVIDER_SHARE in lib/live-streams.ts). */
export const HEART_UNIT_PRICE_CENTS = 1;

export type HeartPackage = { id: string; hearts: number; priceCents: number };

/** Bigger packages give proportionally more hearts per dollar, same "buy more, save more" shape as most gifting economies. */
export const HEART_PACKAGES: HeartPackage[] = [
  { id: "starter", hearts: 100, priceCents: 100 },
  { id: "popular", hearts: 550, priceCents: 500 },
  { id: "value", hearts: 1200, priceCents: 1000 },
  { id: "supporter", hearts: 6500, priceCents: 5000 },
];

export function getHeartPackage(id: string): HeartPackage | undefined {
  return HEART_PACKAGES.find((pkg) => pkg.id === id);
}

/** Quick-send presets shown as tappable gift buttons during a live stream. */
export const GIFT_PRESETS = [1, 10, 50, 100, 500] as const;
