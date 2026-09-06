import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";

export function PayoutCompletedEmail({ amountCents, date }: { amountCents: number; date: string }) {
  return (
    <EmailLayout preview={`${formatCents(amountCents)} has landed in your account`}>
      <Text style={eyebrow}>Payout</Text>
      <Text style={heading}>Payout landed</Text>
      <Text style={paragraph}>
        {formatCents(amountCents)} was sent to your account on <strong>{date}</strong>.
      </Text>
    </EmailLayout>
  );
}
