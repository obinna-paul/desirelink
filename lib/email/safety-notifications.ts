import "server-only";

import { sendEmail } from "@/lib/email/send";
import { getAccountByProfileId } from "@/lib/email/notifications";
import { ReportReceivedEmail } from "@/components/emails/report-received";
import { ReportActionedEmail } from "@/components/emails/report-actioned";
import { ContentRemovedEmail } from "@/components/emails/content-removed";
import { AccountWarningEmail } from "@/components/emails/account-warning";

export async function sendReportReceivedEmail(reporterId: string): Promise<void> {
  const account = await getAccountByProfileId(reporterId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "We've received your report",
    react: ReportReceivedEmail(),
    category: "safety",
    template: "report-received",
  });
}

export async function sendReportActionedEmail(reporterId: string): Promise<void> {
  const account = await getAccountByProfileId(reporterId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "An update on the report you submitted",
    react: ReportActionedEmail(),
    category: "safety",
    template: "report-actioned",
  });
}

const CONTENT_LABEL: Record<string, string> = {
  profile: "profile",
  message: "message",
  post: "post",
  post_comment: "comment",
};

export async function sendContentRemovedEmail(ownerId: string, contentType: string): Promise<void> {
  const account = await getAccountByProfileId(ownerId);
  if (!account) return;
  const contentLabel = CONTENT_LABEL[contentType] ?? "post";
  await sendEmail({
    to: account.user.email,
    subject: `A ${contentLabel} of yours was removed`,
    react: ContentRemovedEmail({ contentLabel }),
    category: "safety",
    template: "content-removed",
  });
}

export async function sendAccountWarningEmail(ownerId: string): Promise<void> {
  const account = await getAccountByProfileId(ownerId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "A warning about your Udala account",
    react: AccountWarningEmail(),
    category: "safety",
    template: "account-warning",
  });
}
