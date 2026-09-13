import "server-only";

import type { ReactElement } from "react";
import { render } from "@react-email/render";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { EMAIL_SENDERS, resend, type EmailSenderKey } from "@/lib/email/client";

export type EmailCategory =
  | "auth"
  | "welcome"
  | "billing"
  | "earnings"
  | "bookings"
  | "safety"
  | "support"
  | "digest"
  | "messages"
  | "leads";

/**
 * Resend's free plan caps us at 100 emails/day, so only these categories are allowed to
 * actually send - everything else (welcome emails, digest/win-back/monthly-earnings/
 * ceo-note/profile-nudge cron jobs) is logged as "skipped" instead. "welcome" stays out of
 * this set on purpose: verification-denied is allowed by template name below, but the rest
 * of that category (welcome-creator/seeker/explorer, verification-approved, ceo-note,
 * profile-nudge) is not.
 */
const ENABLED_EMAIL_CATEGORIES: ReadonlySet<EmailCategory> = new Set<EmailCategory>([
  "auth",
  "billing",
  "earnings",
  "bookings",
  "safety",
  "support",
  "messages",
  "leads",
]);

/** Individually allowed templates whose category is otherwise disabled. */
const ENABLED_EMAIL_TEMPLATES: ReadonlySet<string> = new Set(["verification-denied"]);

function isEmailEnabled(category: EmailCategory, template: string): boolean {
  return ENABLED_EMAIL_CATEGORIES.has(category) || ENABLED_EMAIL_TEMPLATES.has(template);
}

function isMissingEmailLogSchema(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022") &&
    String(error.meta?.table ?? error.meta?.column ?? "").includes("EmailLog")
  );
}

async function logEmail(entry: {
  recipient: string;
  category: EmailCategory;
  template: string;
  resendId: string | null;
  status: "sent" | "failed" | "skipped";
  error: string | null;
}) {
  try {
    await prisma.emailLog.create({ data: entry });
  } catch (error) {
    if (!isMissingEmailLogSchema(error)) console.error("[email] failed to write EmailLog", error);
  }
}

type SendEmailInput = {
  to: string;
  subject: string;
  react: ReactElement;
  category: EmailCategory;
  template: string;
  from?: EmailSenderKey;
  /** Defaults to help@udala.pro for every sender except "help" and "paul" themselves,
   * where a reply already reaches the right inbox without overriding anything. */
  replyTo?: string;
  /** Stable business-event key. Resend suppresses retries of the same email. */
  idempotencyKey?: string;
};

/**
 * Renders and sends one email through Resend, then logs the outcome without throwing.
 * The boolean only tells lifecycle jobs whether Resend accepted the message, so they can
 * retry later. The business action itself never depends on email delivery.
 */
export async function sendEmail({
  to,
  subject,
  react,
  category,
  template,
  from = "hey",
  replyTo,
  idempotencyKey,
}: SendEmailInput): Promise<boolean> {
  if (!isEmailEnabled(category, template)) {
    console.log(`[email] skipping "${subject}" to ${to} - "${template}" (${category}) is disabled`);
    await logEmail({ recipient: to, category, template, resendId: null, status: "skipped", error: null });
    return false;
  }

  const sender = EMAIL_SENDERS[from];
  const resolvedReplyTo = replyTo ?? (from === "hey" ? EMAIL_SENDERS.help.address : undefined);

  let html: string;
  try {
    html = await render(react);
  } catch (error) {
    console.error(`[email] failed to render "${subject}" for ${to}`, error);
    await logEmail({ recipient: to, category, template, resendId: null, status: "failed", error: String(error) });
    return false;
  }

  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set - skipping "${subject}" to ${to}`);
    return false;
  }

  try {
    const result = await resend.emails.send(
      {
        from: `${sender.name} <${sender.address}>`,
        to,
        subject,
        html,
        replyTo: resolvedReplyTo,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    if (result.error) {
      console.error(`[email] Resend rejected "${subject}" to ${to}`, result.error);
      await logEmail({
        recipient: to, category, template,
        resendId: null, status: "failed", error: result.error.message,
      });
      return false;
    }

    await logEmail({
      recipient: to, category, template,
      resendId: result.data?.id ?? null, status: "sent", error: null,
    });
    return true;
  } catch (error) {
    console.error(`[email] send failed for "${subject}" to ${to}`, error);
    await logEmail({ recipient: to, category, template, resendId: null, status: "failed", error: String(error) });
    return false;
  }
}
