import { Text } from "@react-email/components";

import { EmailLayout, colors, heading, muted, paragraph } from "@/components/emails/layout";

export function CeoNoteEmail({ firstName, isCreator }: { firstName: string; isCreator: boolean }) {
  return (
    <EmailLayout preview={`Hey ${firstName}, it's Paul`}>
      <Text style={heading}>Hey {firstName}, it&apos;s Paul</Text>
      <Text style={paragraph}>
        I&apos;m Paul — I started Udala, and I write this note by hand to everyone who joins. Not a bot, not a template
        with your name dropped in twice; I actually want to know how the first few days feel.
      </Text>
      <Text style={paragraph}>
        If something&apos;s confusing, or missing, or you just have an opinion about the app — reply to this email.
        It comes straight to me, and I read all of it.
      </Text>
      <Text style={paragraph}>
        {isCreator
          ? "If you're stuck on pricing your first tier, reply and tell me what you're posting — I'll give you an honest opinion."
          : "Take your time exploring — there's no rush to figure everything out on day one."}
      </Text>
      <Text style={{ ...muted, marginTop: 24, color: colors.ink }}>
        — Paul
        <br />
        Founder, Udala
      </Text>
    </EmailLayout>
  );
}
