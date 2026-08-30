import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ChevronLeft } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatWindow } from "@/components/messages/chat-window";
import { getConversation, getConversations } from "@/lib/messages";
import { isBlockedEitherWay } from "@/lib/block";
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
        select: { id: true, username: true, displayName: true, avatarUrl: true, profileType: true },
      })
    : null;

  const validCounterpart = counterpart && counterpart.id !== viewerProfile.id ? counterpart : null;

  const initialMessages = validCounterpart
    ? await getConversation(viewerProfile.id, validCounterpart.id)
    : [];

  const isBlocked = validCounterpart
    ? await isBlockedEitherWay(viewerProfile.id, validCounterpart.id)
    : false;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex h-[calc(100dvh-12rem)] min-h-[500px] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:h-[calc(100vh-14rem)] md:min-h-[420px] md:rounded-xl md:shadow-none">
        <div
          className={cn(
            "w-full shrink-0 border-r border-border/60 md:w-80",
            validCounterpart && "hidden md:block"
          )}
        >
          <ConversationList
            conversations={conversations}
            viewerProfileId={viewerProfile.id}
            activeUsername={validCounterpart?.username}
          />
        </div>

        <div className={cn("flex min-w-0 flex-1 flex-col", !validCounterpart && "hidden md:flex")}>
          {validCounterpart ? (
            <>
              <Link
                href="/messages"
                className="flex min-h-11 items-center gap-1 border-b border-border/60 px-3 text-sm font-medium text-muted-foreground hover:text-foreground md:hidden"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Inbox
              </Link>
              <div className="flex min-h-0 flex-1 flex-col">
                <ChatWindow
                  viewerProfileId={viewerProfile.id}
                  counterpart={validCounterpart}
                  initialMessages={initialMessages}
                  blocked={isBlocked}
                  viewerHeartsBalance={viewerProfile.heartsBalance}
                />
              </div>
            </>
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
