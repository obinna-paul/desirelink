/**
 * Pure hearts-economy data shared between the server (lib/hearts.ts) and the
 * client (buy-hearts UI, gift picker) — no server-only imports here.
 */

/** 1 heart = 100,000 kobo (₦1,000) of real money. The receiving provider's wallet is credited with their 85% share upfront (see PLATFORM_FEE_RATE in lib/wallet.ts). */
export const HEART_UNIT_PRICE_CENTS = 100_000;

export type HeartPackage = { id: string; hearts: number; priceCents: number };

/** Flat rate — every package is exactly `hearts * HEART_UNIT_PRICE_CENTS`, no bulk discount. */
export const HEART_PACKAGES: HeartPackage[] = [5, 10, 15, 20].map((hearts) => ({
  id: `hearts_${hearts}`,
  hearts,
  priceCents: hearts * HEART_UNIT_PRICE_CENTS,
}));

export function getHeartPackage(id: string): HeartPackage | undefined {
  return HEART_PACKAGES.find((pkg) => pkg.id === id);
}

/** Quick-send presets shown as tappable gift buttons — in a live stream, on a provider's profile, or in chat. */
export const GIFT_PRESETS = [1, 10, 50, 100, 500] as const;
