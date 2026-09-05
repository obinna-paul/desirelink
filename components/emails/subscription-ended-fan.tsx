import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function SubscriptionEndedFanEmail({
  creatorName,
  creatorUsername,
  endsAt,
}: {
  creatorName: string;
  creatorUsername: string;
  endsAt: string;
}) {
  return (
    <EmailLayout preview={`Your subscription to ${creatorName} has ended`}>
      <Text style={eyebrow}>Subscription</Text>
      <Text style={heading}>Your subscription has ended</Text>
      <Text style={paragraph}>
        Your month with {creatorName} ended on <strong>{endsAt}</strong>. Their premium posts are locked again, but
        everything you already saw stays exactly where it was.
      </Text>
      <EmailButton href={absoluteUrl(`/profile/${creatorUsername}`)}>Resubscribe</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— The Udala Team</Text>
    </EmailLayout>
  );
}
