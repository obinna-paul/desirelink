import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function WelcomeCreatorEmail({ firstName }: { firstName: string }) {
  return (
    <EmailLayout preview={`You're in, ${firstName} — let's set up your creator profile`}>
      <Text style={eyebrow}>Welcome</Text>
      <Text style={heading}>You&apos;re in, {firstName}</Text>
      <Text style={paragraph}>
        Three things turn a Udala profile into an income: your subscription tiers, a free post to pull people in,
        and getting verified.
      </Text>
      <Text style={paragraph}>
        Start with your tiers — decide what a subscriber gets and what it costs. Then post something free —
        it&apos;s what shows up in the main feed and gives people a reason to subscribe. Verification comes after;
        it&apos;s what puts the Subscribe button in front of people who aren&apos;t following you yet.
      </Text>
      <EmailButton href={absoluteUrl("/creator-dashboard")}>Set up your tiers</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— The Udala Team</Text>
    </EmailLayout>
  );
}
