import "server-only";

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    return !isProduction;
  }

  return req.headers.get("authorization") === `Bearer ${secret}`;
}
