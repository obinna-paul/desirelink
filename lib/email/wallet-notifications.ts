import "server-only";

import { sendEmail } from "@/lib/email/send";
import { getAccountByProfileId } from "@/lib/email/notifications";
import { PayoutRequestedEmail } from "@/components/emails/payout-requested";
import { PayoutCompletedEmail } from "@/components/emails/payout-completed";
import { PayoutFailedEmail } from "@/components/emails/payout-failed";

export async function sendPayoutRequestedEmail(profileId: string, amountCents: number, withdrawalId: string): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "Payout request received",
    react: PayoutRequestedEmail({ amountCents }),
    category: "earnings",
    template: "payout-requested",
    idempotencyKey: `payout-requested/${withdrawalId}`,
  });
}

export async function sendPayoutCompletedEmail(profileId: string, amountCents: number, withdrawalId: string): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "Payout landed",
    react: PayoutCompletedEmail({
      amountCents,
      date: new Date().toLocaleDateString("en-NG", { dateStyle: "medium" }),
    }),
    category: "earnings",
    template: "payout-completed",
    idempotencyKey: `payout-completed/${withdrawalId}`,
  });
}

export async function sendPayoutFailedEmail(
  profileId: string,
  amountCents: number,
  reason: string | null,
  withdrawalId: string,
): Promise<void> {
  const account = await getAccountByProfileId(profileId);
  if (!account) return;
  await sendEmail({
    to: account.user.email,
    subject: "Payout didn't go through",
    react: PayoutFailedEmail({ amountCents, reason }),
    category: "earnings",
    template: "payout-failed",
    idempotencyKey: `payout-failed/${withdrawalId}`,
  });
}
