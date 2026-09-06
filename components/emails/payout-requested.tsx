import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";

export function PayoutRequestedEmail({ amountCents }: { amountCents: number }) {
  return (
    <EmailLayout preview={`Your payout of ${formatCents(amountCents)} is being reviewed`}>
      <Text style={eyebrow}>Payout</Text>
      <Text style={heading}>Payout request received</Text>
      <Text style={paragraph}>
        Got your request for {formatCents(amountCents)}. We send payouts manually, usually within 2–3 business days.
      </Text>
      <Text style={muted}>We&apos;ll email you the moment it lands.</Text>
    </EmailLayout>
  );
}
