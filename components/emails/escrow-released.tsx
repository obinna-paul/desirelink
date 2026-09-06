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
    <EmailLayout preview={`${formatCents(amountCents)} just hit your wallet`}>
      <Text style={eyebrow}>Booking</Text>
      <Text style={heading}>Paid ✓</Text>
      <Text style={paragraph}>
        <strong>{serviceName}</strong> with {customerName} is done. {formatCents(amountCents)} moved to your wallet.
      </Text>
      <EmailButton href={absoluteUrl("/creator-dashboard?tab=wallet")}>Request a payout</EmailButton>
    </EmailLayout>
  );
}
