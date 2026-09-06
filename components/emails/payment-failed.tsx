import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";
import { absoluteUrl } from "@/lib/site-config";

export function PaymentFailedEmail({ description, amountCents }: { description: string; amountCents: number }) {
  return (
    <EmailLayout preview={`We couldn't process your payment for ${description}`}>
      <Text style={eyebrow}>Payment</Text>
      <Text style={heading}>Payment didn&apos;t go through</Text>
      <Text style={paragraph}>
        {formatCents(amountCents)} for {description} didn&apos;t go through. You weren&apos;t charged.
      </Text>
      <EmailButton href={absoluteUrl("/")}>Try again</EmailButton>
    </EmailLayout>
  );
}
