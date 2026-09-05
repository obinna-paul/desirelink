import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";

export function PayoutRequestedEmail({ amountCents }: { amountCents: number }) {
  return (
    <EmailLayout preview={`Your payout of ${formatCents(amountCents)} is being reviewed`}>
      <Text style={eyebrow}>Payout</Text>
      <Text style={heading}>Your payout request is in</Text>
      <Text style={paragraph}>
        We&apos;ve got your request to withdraw {formatCents(amountCents)}. Our team sends payouts manually from our
        own account, typically within 2-3 business days.
      </Text>
      <Text style={muted}>We&apos;ll email you the moment it lands.</Text>
    </EmailLayout>
  );
}
