import "server-only";

import { cookies } from "next/headers";

/**
 * The reliable fallback for "I took the quiz, then clicked Join Udala without ever using the
 * 'email me this' card" - linkSpecTestResultToProfile (lib/spec-test/legacy.ts) only has an
 * email to match on, and an anonymous taker who skips that card never gives one. This cookie
 * carries the result id itself across the browser session instead, so claiming it at signup
 * needs no email match at all - just the same browser that took the test.
 *
 * Set once, on every anonymous v2 submission (see app/api/spec-test/submit/route.ts), and read
 * at both signup paths (app/api/signup/route.ts for credentials, ensureProfileForAuthUser in
 * lib/auth.ts for Google/X) via claimSpecTestResultById. httpOnly since the value is just an id
 * with no reason for page JS to read or tamper with it - it's not itself sensitive.
 */
export const SPEC_TEST_RESULT_COOKIE = "spec_test_result_id";

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Call only from a Route Handler (or a NextAuth callback running inside one) - Next.js
 *  rejects cookie writes from Server Components. Overwrites any previous value, so retaking
 *  the quiz a few times anonymously before signing up always points at the latest attempt. */
export function setSpecTestResultCookie(resultId: string): void {
  cookies().set(SPEC_TEST_RESULT_COOKIE, resultId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

export function readSpecTestResultCookie(): string | null {
  return cookies().get(SPEC_TEST_RESULT_COOKIE)?.value ?? null;
}

/** Best-effort cleanup once a signup has used the cookie - not load-bearing (a stale id just
 *  becomes a permanent no-op once claimed, since claimSpecTestResultById only ever claims an
 *  unclaimed row), so a failure here is fine to ignore. */
export function clearSpecTestResultCookie(): void {
  cookies().delete(SPEC_TEST_RESULT_COOKIE);
}
