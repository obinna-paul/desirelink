import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";
import { absoluteUrl } from "@/lib/site-config";

export function MonthlyEarningsEmail({
  month,
  newSubscriptionRevenueCents,
  newSubscriberCount,
  unsubscribeUrl,
}: {
  month: string;
  newSubscriptionRevenueCents: number;
  newSubscriberCount: number;
  unsubscribeUrl: string;
}) {
  return (
    <EmailLayout preview={`Your Udala earnings for ${month}`} unsubscribeUrl={unsubscribeUrl}>
      <Text style={eyebrow}>Monthly summary</Text>
      <Text style={heading}>Your earnings for {month}</Text>
      <Text style={paragraph}>
        New subscription revenue: <strong>{formatCents(newSubscriptionRevenueCents)}</strong> from{" "}
        <strong>{newSubscriberCount}</strong> new {newSubscriberCount === 1 ? "subscriber" : "subscribers"}.
      </Text>
      <Text style={paragraph}>
        This covers new subscriptions only — gifts, bookings, and renewals aren&apos;t counted here yet.
      </Text>
      <EmailButton href={absoluteUrl("/creator-dashboard?tab=wallet")}>View your wallet</EmailButton>
    </EmailLayout>
  );
}
