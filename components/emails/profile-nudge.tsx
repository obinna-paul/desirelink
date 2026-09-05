import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function ProfileNudgeEmail({ firstName, missingField }: { firstName: string; missingField: string }) {
  return (
    <EmailLayout preview={`Your profile is still missing ${missingField}`}>
      <Text style={eyebrow}>Profile</Text>
      <Text style={heading}>Your profile is still missing something, {firstName}</Text>
      <Text style={paragraph}>
        Your Udala profile is still missing <strong>{missingField}</strong>. It&apos;s the first thing people see before
        deciding to say hello — or subscribe.
      </Text>
      <EmailButton href={absoluteUrl("/profile/edit")}>Finish your profile</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— The Udala Team</Text>
    </EmailLayout>
  );
}
