import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";

export function BookingConfirmedEmail({
  providerName,
  serviceName,
  requestedAt,
  amountCents,
}: {
  providerName: string;
  serviceName: string;
  requestedAt: string;
  amountCents: number;
}) {
  return (
    <EmailLayout preview={`Your booking with ${providerName} is confirmed`}>
      <Text style={eyebrow}>Booking</Text>
      <Text style={heading}>Your booking is confirmed</Text>
      <Text style={paragraph}>
        {providerName} confirmed <strong>{serviceName}</strong> for <strong>{requestedAt}</strong>.
      </Text>
      <Text style={paragraph}>
        Your {formatCents(amountCents)} stays held in escrow until the booking is complete — {providerName} isn&apos;t
        paid until then.
      </Text>
    </EmailLayout>
  );
}
