import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { NewMessageEmail } from "@/components/emails/new-message";
import { absoluteUrl } from "@/lib/site-config";
import { isPlaceholderEmail } from "@/lib/oauth-placeholder-email";
import type { ConversationMediaType } from "@/lib/message-types";

const PREVIEW_LENGTH = 140;

// Deliberately not imported from lib/messages.ts's own mediaLabel() - that module
// imports this one (to fire the email after creating a message), so importing back
// from here would make the two files circular.
function mediaNoun(type: ConversationMediaType | null): string {
  if (type === "image") return "photo";
  if (type === "video") return "video";
  if (type === "audio") return "voice note";
  return "message";
}

function previewFor(content: string, mediaType: ConversationMediaType | null): string {
  const trimmed = content.trim();
  if (trimmed) {
    return trimmed.length > PREVIEW_LENGTH ? `${trimmed.slice(0, PREVIEW_LENGTH).trimEnd()}...` : trimmed;
  }
  return `Sent a ${mediaNoun(mediaType)}`;
}

/**
 * Emails the recipient about a new message - but only once per unread streak: if they
 * already have an older unread message from this same sender, they've already been told,
 * so this stays quiet rather than emailing again for every message in an active back-
 * and-forth. Reading the conversation clears that streak, so the next new message after
 * catching up emails again. Fire-and-forget: must never block or fail sendMessage.
 */
export function notifyNewMessageByEmail(params: {
  messageId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  recipientId: string;
  content: string;
  mediaType: ConversationMediaType | null;
}): void {
  void (async () => {
    try {
      const olderUnread = await prisma.message.findFirst({
        where: {
          senderId: params.senderId,
          recipientId: params.recipientId,
          readAt: null,
          id: { not: params.messageId },
        },
        select: { id: true },
      });
      if (olderUnread) return;

      const recipient = await prisma.profile.findUnique({
        where: { id: params.recipientId },
        select: { user: { select: { email: true } } },
      });
      if (!recipient || isPlaceholderEmail(recipient.user.email)) return;

      await sendEmail({
        to: recipient.user.email,
        subject: `${params.senderDisplayName} sent you a message`,
        react: NewMessageEmail({
          senderDisplayName: params.senderDisplayName,
          preview: previewFor(params.content, params.mediaType),
          conversationUrl: absoluteUrl(`/messages?with=${params.senderUsername}`),
        }),
        category: "messages",
        template: "new-message",
      });
    } catch (error) {
      console.error("[email] new-message notification failed", error);
    }
  })();
}
