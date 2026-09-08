import "server-only";

import { createNotificationsBulk } from "@/lib/notifications";
import { extractMentionUsernames } from "@/lib/mentions";
import { prisma } from "@/lib/prisma";

export async function notifyMentionedProfiles({
  actorId,
  actorDisplayName,
  content,
  href,
  context,
  excludeRecipientIds = [],
  usernames,
}: {
  actorId: string;
  actorDisplayName: string;
  content: string;
  href: string;
  context: "post" | "comment";
  excludeRecipientIds?: string[];
  usernames?: string[];
}) {
  const mentionedUsernames = usernames ?? extractMentionUsernames(content);
  if (mentionedUsernames.length === 0) return;

  const excluded = new Set([actorId, ...excludeRecipientIds]);
  const recipients = await prisma.profile.findMany({
    where: {
      username: { in: mentionedUsernames },
      id: { notIn: Array.from(excluded) },
      isSuspended: false,
      blocksReceived: { none: { blockerId: actorId } },
      blocksMade: { none: { blockedId: actorId } },
    },
    select: { id: true },
  });

  await createNotificationsBulk(
    recipients.map((recipient) => ({
      recipientId: recipient.id,
      actorId,
      type: "mention" as const,
      title: `${actorDisplayName} mentioned you`,
      body: context === "post" ? "See the post where you were mentioned." : "See the comment where you were mentioned.",
      href,
    })),
  );
}
