import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatWindow } from "@/components/messages/chat-window";
import { getConversation, getConversations } from "@/lib/messages";
import { getBlockRelationship } from "@/lib/block";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { with?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, heartsBalance: true },
  });
  if (!viewerProfile) {
    redirect("/login");
  }

  const conversations = await getConversations(viewerProfile.id);

  const counterpart = searchParams.with
    ? await prisma.profile.findUnique({
        where: { username: searchParams.with },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          profileType: true,
          isVerified: true,
          isVerifiedCreator: true,
          isVerifiedServiceProvider: true,
          verificationPending: true,
        },
      })
    : null;

  const validCounterpart = counterpart && counterpart.id !== viewerProfile.id ? counterpart : null;

  const initialMessages = validCounterpart
    ? await getConversation(viewerProfile.id, validCounterpart.id)
    : [];

  const blockRelationship = validCounterpart
    ? await getBlockRelationship(viewerProfile.id, validCounterpart.id)
    : "none";

  return (
    <div className="-mx-4 -mt-4 md:mx-auto md:mt-0 md:max-w-6xl">
      <div className="flex h-[calc(100dvh-8.25rem)] min-h-[520px] overflow-hidden border-y border-border/60 bg-card md:h-[calc(100vh-9.5rem)] md:min-h-[560px] md:rounded-lg md:border md:shadow-sm">
        <div
          className={cn(
            "w-full shrink-0 border-r border-border/60 md:w-[320px]",
            validCounterpart && "hidden md:block"
          )}
        >
          <ConversationList
            conversations={conversations}
            viewerProfileId={viewerProfile.id}
            activeUsername={validCounterpart?.username}
          />
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            !validCounterpart && "hidden md:flex",
            validCounterpart && "fixed inset-0 z-[60] h-dvh bg-card md:static md:z-auto md:h-auto"
          )}
        >
          {validCounterpart ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <ChatWindow
                viewerProfileId={viewerProfile.id}
                counterpart={validCounterpart}
                initialMessages={initialMessages}
                blockRelationship={blockRelationship}
                viewerHeartsBalance={viewerProfile.heartsBalance}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Select a conversation, or message someone from their profile to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
