import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function WinBackEmail({
  firstName,
  count,
  audience,
  unsubscribeUrl,
}: {
  firstName: string;
  count: number;
  /** What `count` is counting - creators (Explorer/Creator's core value prop) vs. new
   *  people to meet (Seeker's). */
  audience: "creators" | "people";
  unsubscribeUrl: string;
}) {
  const label = audience === "creators" ? "new creators" : "new people";
  const preview = count > 0 ? `${count} ${label} have joined since you last checked in` : "There's a lot you've missed";
  return (
    <EmailLayout preview={preview} unsubscribeUrl={unsubscribeUrl}>
      <Text style={eyebrow}>We miss you</Text>
      <Text style={heading}>It&apos;s quiet without you, {firstName}</Text>
      <Text style={paragraph}>
        {count > 0
          ? `${count} ${label} have joined since you last checked in.`
          : "There's a lot you've missed since you last checked in."}
      </Text>
      <EmailButton href={absoluteUrl("/")}>Come back to Udala</EmailButton>
    </EmailLayout>
  );
}
