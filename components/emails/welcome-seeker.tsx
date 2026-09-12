import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function WelcomeSeekerEmail({ firstName, city }: { firstName: string; city: string | null }) {
  return (
    <EmailLayout preview="Someone worth meeting could be one message away">
      <Text style={eyebrow}>Welcome</Text>
      <Text style={heading}>You&apos;re in, {firstName}</Text>
      <Text style={paragraph}>
        Udala&apos;s where you find someone worth getting to know. Add a photo, browse a few profiles, and send the
        first message when you&apos;re ready.{city ? ` There are people near ${city} you haven't met yet.` : ""}
      </Text>
      <EmailButton href={absoluteUrl("/profile/edit")}>Complete your profile</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
