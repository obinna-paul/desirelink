import { Text } from "@react-email/components";

import { EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function SubscriptionEndedCreatorEmail({
  fanName,
  tierName,
  endsAt,
}: {
  fanName: string;
  tierName: string;
  endsAt: string;
}) {
  return (
    <EmailLayout preview={`${fanName}'s subscription to ${tierName} ended`}>
      <Text style={eyebrow}>Subscription</Text>
      <Text style={heading}>{fanName} moved on</Text>
      <Text style={paragraph}>
        {fanName}&apos;s <strong>{tierName}</strong> sub ended <strong>{endsAt}</strong>.
      </Text>
      <Text style={paragraph}>A new post is the fastest way to get them back.</Text>
      <Text style={muted}>— Udala</Text>
    </EmailLayout>
  );
}
