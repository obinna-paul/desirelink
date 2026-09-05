import "server-only";

import crypto from "node:crypto";

import { absoluteUrl } from "@/lib/site-config";

/**
 * Signs a profileId into a one-click unsubscribe token - no login required to use the
 * link, since the whole point is that it works even if someone never comes back to the
 * app. HMAC rather than a DB-stored token: stateless, and there's nothing to clean up.
 */
function sign(profileId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(profileId).digest("base64url");
}

export function unsubscribeUrlFor(profileId: string): string {
  const token = sign(profileId);
  return absoluteUrl(`/api/unsubscribe?profileId=${encodeURIComponent(profileId)}&token=${token}`);
}

/** Constant-time compare so this can't be brute-forced by timing. Returns false (not an
 * error) when UNSUBSCRIBE_SECRET isn't set - see isUnsubscribeConfigured. */
export function verifyUnsubscribeToken(profileId: string, token: string): boolean {
  if (!process.env.UNSUBSCRIBE_SECRET) return false;

  const expected = Buffer.from(sign(profileId));
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

/** Phase 5's sends should skip entirely (rather than link to a broken/insecure
 * unsubscribe) if this hasn't been configured yet. */
export function isUnsubscribeConfigured(): boolean {
  return Boolean(process.env.UNSUBSCRIBE_SECRET);
}
