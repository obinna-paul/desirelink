import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function WelcomeCreatorEmail({ firstName }: { firstName: string }) {
  return (
    <EmailLayout preview="Three things stand between you and your first subscriber">
      <Text style={eyebrow}>Welcome</Text>
      <Text style={heading}>Let&apos;s get you paid, {firstName}</Text>
      <Text style={paragraph}>
        Set your tiers first — what someone gets, what it costs. Then post something free; that&apos;s what gets seen.
        Verification comes last, once you&apos;re ready for strangers to find you.
      </Text>
      <EmailButton href={absoluteUrl("/creator-dashboard")}>Set up your tiers</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
