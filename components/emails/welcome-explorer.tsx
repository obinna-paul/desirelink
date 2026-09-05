import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";
import { absoluteUrl } from "@/lib/site-config";

export function WelcomeExplorerEmail({ firstName, city }: { firstName: string; city: string | null }) {
  return (
    <EmailLayout preview={`Welcome to Udala, ${firstName}`}>
      <Text style={eyebrow}>Welcome</Text>
      <Text style={heading}>Welcome to Udala, {firstName}</Text>
      <Text style={paragraph}>
        You&apos;re in. Udala is where you discover people and creators near you, follow the ones you like, and go live
        together — all in one feed.
      </Text>
      <Text style={paragraph}>
        A couple of things worth doing first: add a real photo (people take a profile more seriously with one)
        {city ? `, and take a look at who's live right now near ${city}.` : "."}
      </Text>
      <EmailButton href={absoluteUrl("/profile/edit")}>Complete your profile</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>— The Udala Team</Text>
    </EmailLayout>
  );
}
