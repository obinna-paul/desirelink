import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True only when a secret is actually configured - lets every call site skip verification
 * in local dev/CI without Cloudflare credentials, the same tolerance already used for
 * Cloudinary/LiveKit/CRON_SECRET elsewhere in this app. Always set TURNSTILE_SECRET_KEY in
 * production; leaving it unset there means every submission is accepted unchecked. */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Verifies a Turnstile response token with Cloudflare's siteverify endpoint. Returns true
 * (no-op) when TURNSTILE_SECRET_KEY isn't set - see isTurnstileConfigured. A missing/blank
 * token is always rejected once Turnstile is configured, so a client that never rendered
 * the widget (or stripped it) can't skip the check by just omitting the field.
 */
export async function verifyTurnstileToken(token: string | null | undefined, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return Boolean(body?.success);
  } catch (error) {
    console.error("[turnstile] verification request failed", error);
    return false;
  }
}
