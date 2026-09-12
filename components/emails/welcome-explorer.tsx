import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function WelcomeExplorerEmail({ firstName, city }: { firstName: string; city: string | null }) {
  return (
    <EmailLayout preview="Add a photo and see who's live right now">
      <Text style={eyebrow}>Welcome</Text>
      <Text style={heading}>You&apos;re in, {firstName}</Text>
      <Text style={paragraph}>
        Udala&apos;s where you find people worth watching and go live with them. Add a photo, explore a few profiles, see
        who&apos;s live.{city ? ` There's usually someone live near ${city} right now.` : ""}
      </Text>
      <EmailButton href={absoluteUrl("/profile/edit")}>Complete your profile</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— Udala</Text>
    </EmailLayout>
  );
}
