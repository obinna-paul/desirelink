import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";
import { absoluteUrl } from "@/lib/site-config";

export function PayoutFailedEmail({ amountCents, reason }: { amountCents: number; reason: string | null }) {
  return (
    <EmailLayout preview="Your Udala payout didn't go through">
      <Text style={eyebrow}>Payout</Text>
      <Text style={heading}>Your payout didn&apos;t go through</Text>
      <Text style={paragraph}>
        We couldn&apos;t send {formatCents(amountCents)} to the account on file{reason ? ` — ${reason}` : ""}. Nothing
        was lost; it&apos;s back in your wallet.
      </Text>
      <EmailButton href={absoluteUrl("/creator-dashboard?tab=wallet")}>Update your payout details</EmailButton>
    </EmailLayout>
  );
}
