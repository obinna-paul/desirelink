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
      <Text style={heading}>A subscription ended</Text>
      <Text style={paragraph}>
        {fanName}&apos;s month on <strong>{tierName}</strong> ended on <strong>{endsAt}</strong>.
      </Text>
      <Text style={paragraph}>A fresh post from you is the single best way to bring a subscriber back.</Text>
      <Text style={muted}>— The Udala Team</Text>
    </EmailLayout>
  );
}
