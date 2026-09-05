import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";

export function SubscriptionReceiptEmail({
  creatorName,
  tierName,
  amountCents,
  date,
  reference,
}: {
  creatorName: string;
  tierName: string;
  amountCents: number;
  date: string;
  reference: string;
}) {
  return (
    <EmailLayout preview={`Your Udala receipt — ${tierName} (${formatCents(amountCents)})`}>
      <Text style={eyebrow}>Receipt</Text>
      <Text style={heading}>Your receipt</Text>
      <Text style={paragraph}>
        <strong>Creator</strong> {creatorName}
        <br />
        <strong>Tier</strong> {tierName}
        <br />
        <strong>Amount</strong> {formatCents(amountCents)}
        <br />
        <strong>Date</strong> {date}
        <br />
        <strong>Reference</strong> {reference}
      </Text>
      <Text style={muted}>Keep this for your records.</Text>
    </EmailLayout>
  );
}
