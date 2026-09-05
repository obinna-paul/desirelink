/**
 * X's OAuth 2.0 API never returns a user's email address, for any app at any access
 * tier - next-auth's own built-in Twitter provider hardcodes `email: null` for exactly
 * this reason. Since User.email is required and unique, a real value is still needed at
 * account-creation time, so lib/auth.ts's Twitter provider config generates one of these
 * instead - unreachable, but valid and unique per X account. ensureProfileForAuthUser
 * detects it via isPlaceholderEmail and gates the account on /onboarding/email (see
 * Profile.emailChosen) until a real address is confirmed.
 */

const PLACEHOLDER_EMAIL_DOMAIN = "no-email.udala.pro";

export function placeholderEmailFor(providerAccountId: string): string {
  return `x-${providerAccountId}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}
