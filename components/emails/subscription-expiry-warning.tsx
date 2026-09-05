import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function SubscriptionExpiryWarningEmail({
  creatorName,
  creatorUsername,
  tierName,
  endsAt,
}: {
  creatorName: string;
  creatorUsername: string;
  tierName: string;
  endsAt: string;
}) {
  return (
    <EmailLayout preview={`Your ${creatorName} subscription ends in 3 days`}>
      <Text style={eyebrow}>Subscription</Text>
      <Text style={heading}>Ends in 3 days</Text>
      <Text style={paragraph}>
        Your <strong>{tierName}</strong> subscription to {creatorName} ends on <strong>{endsAt}</strong> — it won&apos;t
        renew by itself.
      </Text>
      <Text style={paragraph}>Want to keep your access to their premium posts? Resubscribe before then.</Text>
      <EmailButton href={absoluteUrl(`/profile/${creatorUsername}`)}>Resubscribe</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— The Udala Team</Text>
    </EmailLayout>
  );
}
