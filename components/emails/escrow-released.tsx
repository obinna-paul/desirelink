import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";
import { absoluteUrl } from "@/lib/site-config";

export function EscrowReleasedEmail({
  customerName,
  serviceName,
  amountCents,
}: {
  customerName: string;
  serviceName: string;
  amountCents: number;
}) {
  return (
    <EmailLayout preview={`${formatCents(amountCents)} released to your wallet`}>
      <Text style={eyebrow}>Booking</Text>
      <Text style={heading}>Escrow released</Text>
      <Text style={paragraph}>
        <strong>{serviceName}</strong> with {customerName} is complete — {formatCents(amountCents)} just moved from
        escrow into your wallet.
      </Text>
      <EmailButton href={absoluteUrl("/creator-dashboard?tab=wallet")}>Request a payout</EmailButton>
    </EmailLayout>
  );
}
