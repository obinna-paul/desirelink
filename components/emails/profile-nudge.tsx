import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function ProfileNudgeEmail({ missingField }: { missingField: string }) {
  return (
    <EmailLayout preview="Takes two minutes to fix">
      <Text style={eyebrow}>Profile</Text>
      <Text style={heading}>You&apos;re missing {missingField}</Text>
      <Text style={paragraph}>
        Your profile&apos;s missing <strong>{missingField}</strong>. People decide fast — that&apos;s usually the first thing
        they check.
      </Text>
      <EmailButton href={absoluteUrl("/profile/edit")}>Fix it</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
