import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function WinBackEmail({
  firstName,
  newCreatorCount,
  unsubscribeUrl,
}: {
  firstName: string;
  newCreatorCount: number;
  unsubscribeUrl: string;
}) {
  return (
    <EmailLayout preview={`It's quiet without you, ${firstName}`} unsubscribeUrl={unsubscribeUrl}>
      <Text style={eyebrow}>We miss you</Text>
      <Text style={heading}>It&apos;s quiet without you, {firstName}</Text>
      <Text style={paragraph}>
        {newCreatorCount > 0
          ? `${newCreatorCount} new creators have joined since you last checked in.`
          : "There's a lot you've missed since you last checked in."}
      </Text>
      <EmailButton href={absoluteUrl("/")}>Come back to Udala</EmailButton>
    </EmailLayout>
  );
}
