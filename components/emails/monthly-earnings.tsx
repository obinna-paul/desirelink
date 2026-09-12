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
    <EmailLayout
      preview={`${formatCents(newSubscriptionRevenueCents)} from ${newSubscriberCount} new subscriber${newSubscriberCount === 1 ? "" : "s"}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={eyebrow}>Monthly summary</Text>
      <Text style={heading}>Your {month} earnings</Text>
      <Text style={paragraph}>
        New subscription revenue: <strong>{formatCents(newSubscriptionRevenueCents)}</strong> from{" "}
        <strong>{newSubscriberCount}</strong> new subscriber{newSubscriberCount === 1 ? "" : "s"}.
      </Text>
      <Text style={paragraph}>
        Gifts, bookings, and renewals aren&apos;t in this number yet.
      </Text>
      <EmailButton href={absoluteUrl("/creator-dashboard?tab=wallet")}>View your wallet</EmailButton>
    </EmailLayout>
  );
}
