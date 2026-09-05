import "server-only";

import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { getHeaderValue } from "@/lib/security/request";
import { sendEmail } from "@/lib/email/send";
import { NewDeviceSignInEmail } from "@/components/emails/new-device-signin";

function fingerprintFor(userAgent: string): string {
  return crypto.createHash("sha256").update(userAgent).digest("hex");
}

/** Best-effort, dependency-free label from a User-Agent string - good enough for a
 * security email ("Chrome on Mac"), not meant to be exact. */
function describeUserAgent(userAgent: string): string {
  const os = userAgent.includes("iPhone")
    ? "iPhone"
    : userAgent.includes("iPad")
      ? "iPad"
      : userAgent.includes("Android")
        ? "Android"
        : userAgent.includes("Macintosh")
          ? "Mac"
          : userAgent.includes("Windows")
            ? "Windows"
            : "an unrecognized device";

  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "a browser";

  return `${browser} on ${os}`;
}

type HeaderBag = Headers | Record<string, string | string[] | undefined> | undefined;

/**
 * Fires the "new sign-in" email the first time a successful login comes from a
 * device/browser fingerprint not seen on this account before - never on the very first
 * login ever, since that's just signup, not a surprise. Fire-and-forget and swallows
 * every error: called from NextAuth's authorize() callback, which must never fail or
 * slow down because of this.
 */
export function recordDeviceAndMaybeAlert(userId: string, email: string, headers: HeaderBag): void {
  void (async () => {
    try {
      const userAgent = getHeaderValue(headers, "user-agent") ?? "unknown";
      const fingerprint = fingerprintFor(userAgent);

      const [deviceCount, existing] = await Promise.all([
        prisma.knownDevice.count({ where: { userId } }),
        prisma.knownDevice.findUnique({ where: { userId_fingerprint: { userId, fingerprint } } }),
      ]);

      if (existing) {
        await prisma.knownDevice.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } });
        return;
      }

      await prisma.knownDevice.create({ data: { userId, fingerprint } });
      if (deviceCount === 0) return;

      await sendEmail({
        to: email,
        subject: "New sign-in to your Udala account",
        react: NewDeviceSignInEmail({
          device: describeUserAgent(userAgent),
          timestamp: new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }),
        }),
        category: "auth",
        template: "new-device-signin",
      });
    } catch (error) {
      console.error("[email] new-device check failed", error);
    }
  })();
}
