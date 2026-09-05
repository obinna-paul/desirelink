import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { formatCents } from "@/lib/creator";
import { absoluteUrl } from "@/lib/site-config";

export function SubscriptionConfirmedEmail({
  creatorName,
  creatorUsername,
  tierName,
  priceCents,
  endsAt,
}: {
  creatorName: string;
  creatorUsername: string;
  tierName: string;
  priceCents: number;
  endsAt: string;
}) {
  return (
    <EmailLayout preview={`You're subscribed to ${creatorName}`}>
      <Text style={eyebrow}>Subscription</Text>
      <Text style={heading}>You&apos;re subscribed to {creatorName}</Text>
      <Text style={paragraph}>
        You&apos;re now on {creatorName}&apos;s <strong>{tierName}</strong> tier ({formatCents(priceCents)}/mo)
        through <strong>{endsAt}</strong>.
      </Text>
      <Text style={paragraph}>
        This is a one-month subscription and it doesn&apos;t renew on its own — we&apos;ll remind you a few days
        before it ends if you&apos;d like to keep going.
      </Text>
      <EmailButton href={absoluteUrl(`/profile/${creatorUsername}`)}>See {creatorName}&apos;s premium posts</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— The Udala Team</Text>
    </EmailLayout>
  );
}
