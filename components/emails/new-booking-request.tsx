import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";
import { absoluteUrl } from "@/lib/site-config";

export function NewBookingRequestEmail({
  customerName,
  serviceName,
  requestedAt,
  amountCents,
}: {
  customerName: string;
  serviceName: string;
  requestedAt: string;
  amountCents: number;
}) {
  return (
    <EmailLayout preview={`${customerName} wants to book you`}>
      <Text style={eyebrow}>Booking</Text>
      <Text style={heading}>New booking request</Text>
      <Text style={paragraph}>
        {customerName} requested <strong>{serviceName}</strong> for <strong>{requestedAt}</strong>.{" "}
        {formatCents(amountCents)} is already in escrow, waiting.
      </Text>
      <EmailButton href={absoluteUrl("/services/bookings")}>Accept or decline</EmailButton>
    </EmailLayout>
  );
}
