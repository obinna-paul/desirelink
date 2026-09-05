import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";

export function BookingCancelledEmail({
  audience,
  serviceName,
  requestedAt,
  amountCents,
  reason,
}: {
  /** "customer" gets the refund line; "provider" (told when the customer cancels a
   * confirmed booking) never held the money, so gets a different closing line instead. */
  audience: "customer" | "provider";
  serviceName: string;
  requestedAt: string;
  amountCents: number;
  reason: string | null;
}) {
  return (
    <EmailLayout preview={`Your booking for ${serviceName} was cancelled`}>
      <Text style={eyebrow}>Booking</Text>
      <Text style={heading}>Booking cancelled</Text>
      <Text style={paragraph}>
        <strong>{serviceName}</strong> for <strong>{requestedAt}</strong> was cancelled{reason ? `: ${reason}` : "."}
      </Text>
      <Text style={paragraph}>
        {audience === "customer"
          ? `${formatCents(amountCents)} is being refunded to you in full.`
          : "No payment was ever released to you for this booking."}
      </Text>
    </EmailLayout>
  );
}
