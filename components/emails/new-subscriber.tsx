import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";
import { absoluteUrl } from "@/lib/site-config";

export function NewSubscriberEmail({
  fanName,
  tierName,
  amountCents,
}: {
  fanName: string;
  tierName: string;
  amountCents: number;
}) {
  return (
    <EmailLayout preview={`${fanName} just subscribed to ${tierName}`}>
      <Text style={eyebrow}>New subscriber</Text>
      <Text style={heading}>New subscriber 🎉</Text>
      <Text style={paragraph}>
        {fanName} just grabbed <strong>{tierName}</strong>. {formatCents(amountCents)} is sitting in your wallet.
      </Text>
      <EmailButton href={absoluteUrl("/creator-dashboard?tab=wallet")}>View your wallet</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
