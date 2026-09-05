import "server-only";

import { sendEmail } from "@/lib/email/send";
import { getAccountByProfileId } from "@/lib/email/notifications";
import { formatCents } from "@/lib/creator";
import { PayoutRequestedEmail } from "@/components/emails/payout-requested";
import { PayoutCompletedEmail } from "@/components/emails/payout-completed";
import { PayoutFailedEmail } from "@/components/emails/payout-failed";

export async function sendPayoutRequestedEmail(profileId: string, amountCents: number): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "Your payout request is in",
    react: PayoutRequestedEmail({ amountCents }),
    category: "earnings",
    template: "payout-requested",
  });
}

export async function sendPayoutCompletedEmail(profileId: string, amountCents: number): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: `${formatCents(amountCents)} has landed in your account`,
    react: PayoutCompletedEmail({
      amountCents,
      date: new Date().toLocaleDateString("en-NG", { dateStyle: "medium" }),
    }),
    category: "earnings",
    template: "payout-completed",
  });
}

export async function sendPayoutFailedEmail(profileId: string, amountCents: number, reason: string | null): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "Your Udala payout didn't go through",
    react: PayoutFailedEmail({ amountCents, reason }),
    category: "earnings",
    template: "payout-failed",
  });
}
