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
      <Text style={heading}>That&apos;s it for now</Text>
      <Text style={paragraph}>
        Your month with {creatorName} wrapped <strong>{endsAt}</strong>. Premium&apos;s locked again, but what you already
        saw isn&apos;t going anywhere.
      </Text>
      <EmailButton href={absoluteUrl(`/profile/${creatorUsername}`)}>Resubscribe</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
