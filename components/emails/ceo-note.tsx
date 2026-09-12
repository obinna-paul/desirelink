import { Text } from "@react-email/components";

import { EmailLayout, colors, heading, muted, paragraph } from "@/components/emails/layout";

export function CeoNoteEmail({ firstName, isCreator }: { firstName: string; isCreator: boolean }) {
  return (
    <EmailLayout
      preview={
        isCreator
          ? "Pricing your first tier is the hardest part — happy to help"
          : "If something's broken or missing, reply here — it comes to me"
      }
    >
      <Text style={heading}>Hey {firstName}, it&apos;s Paul</Text>
      <Text style={paragraph}>
        I&apos;m Paul, I built Udala. If something&apos;s broken or missing, reply here — it comes to me.
      </Text>
      <Text style={paragraph}>
        {isCreator
          ? "Pricing your first tier is the hardest part. Reply and tell me what you're posting, happy to give you a real opinion."
          : "Have a look around. No rush."}
      </Text>
      <Text style={{ ...muted, marginTop: 24, color: colors.ink }}>— Paul</Text>
    </EmailLayout>
  );
}
