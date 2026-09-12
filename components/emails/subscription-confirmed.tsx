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
    <EmailLayout preview={`${tierName} unlocked through ${endsAt}`}>
      <Text style={eyebrow}>Subscription</Text>
      <Text style={heading}>You&apos;re in — {creatorName}</Text>
      <Text style={paragraph}>
        You&apos;ve got <strong>{tierName}</strong> ({formatCents(priceCents)}/mo) through <strong>{endsAt}</strong>.
      </Text>
      <Text style={paragraph}>One month, doesn&apos;t auto-renew. We&apos;ll ping you before it ends.</Text>
      <EmailButton href={absoluteUrl(`/profile/${creatorUsername}`)}>See {creatorName}&apos;s posts</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
