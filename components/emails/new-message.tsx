import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, eyebrow, heading, muted, paragraph } from "@/components/emails/layout";

export function NewMessageEmail({
  senderDisplayName,
  preview,
  conversationUrl,
}: {
  senderDisplayName: string;
  preview: string;
  conversationUrl: string;
}) {
  return (
    <EmailLayout preview={preview}>
      <Text style={eyebrow}>New message</Text>
      <Text style={heading}>{senderDisplayName} sent you a message</Text>
      <Text style={paragraph}>&ldquo;{preview}&rdquo;</Text>
      <EmailButton href={conversationUrl}>Reply</EmailButton>
      <Text style={{ ...muted, marginTop: 24 }}>
        You&apos;ll only get this once per new conversation activity - no repeat emails while you have an
        unread message waiting.
      </Text>
    </EmailLayout>
  );
}
