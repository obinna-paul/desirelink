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
  | "digest";

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
  status: "sent" | "failed";
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
};

/**
 * Renders and sends one email through Resend, then logs the outcome - and never throws.
 * Every call site fires this without awaiting anything downstream of it (or awaits it but
 * ignores a throw), the same way safeConfirmPayment works for payment confirmation: a
 * subscription, a signup, a payout must all succeed or fail on their own terms, never on
 * whether an email happened to go out.
 */
export async function sendEmail({ to, subject, react, category, template, from = "hey", replyTo }: SendEmailInput): Promise<void> {
  const sender = EMAIL_SENDERS[from];
  const resolvedReplyTo = replyTo ?? (from === "hey" ? EMAIL_SENDERS.help.address : undefined);

  let html: string;
  try {
    html = await render(react);
  } catch (error) {
    console.error(`[email] failed to render "${subject}" for ${to}`, error);
    await logEmail({ recipient: to, category, template, resendId: null, status: "failed", error: String(error) });
    return;
  }

  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set - skipping "${subject}" to ${to}`);
    return;
  }

  try {
    const result = await resend.emails.send({
      from: `${sender.name} <${sender.address}>`,
      to,
      subject,
      html,
      replyTo: resolvedReplyTo,
    });

    if (result.error) {
      console.error(`[email] Resend rejected "${subject}" to ${to}`, result.error);
      await logEmail({
        recipient: to, category, template,
        resendId: null, status: "failed", error: result.error.message,
      });
      return;
    }

    await logEmail({
      recipient: to, category, template,
      resendId: result.data?.id ?? null, status: "sent", error: null,
    });
  } catch (error) {
    console.error(`[email] send failed for "${subject}" to ${to}`, error);
    await logEmail({ recipient: to, category, template, resendId: null, status: "failed", error: String(error) });
  }
}
