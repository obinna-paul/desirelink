import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ChevronLeft } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatWindow } from "@/components/messages/chat-window";
import { getConversation, getConversations } from "@/lib/messages";
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
    select: { id: true },
  });
  if (!viewerProfile) {
    redirect("/login");
  }

  const conversations = await getConversations(viewerProfile.id);

  const counterpart = searchParams.with
    ? await prisma.profile.findUnique({
        where: { username: searchParams.with },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      })
    : null;

  const validCounterpart = counterpart && counterpart.id !== viewerProfile.id ? counterpart : null;

  const initialMessages = validCounterpart
    ? await getConversation(viewerProfile.id, validCounterpart.id)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Messages" description="Direct conversations with your connections." />

      <div className="flex h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden rounded-xl border border-border/60 bg-card">
        <div
          className={cn(
            "w-full shrink-0 border-r border-border/60 sm:w-80",
            validCounterpart && "hidden sm:block"
          )}
        >
          <ConversationList
            conversations={conversations}
            viewerProfileId={viewerProfile.id}
            activeUsername={validCounterpart?.username}
          />
        </div>

        <div className={cn("flex min-w-0 flex-1 flex-col", !validCounterpart && "hidden sm:flex")}>
          {validCounterpart ? (
            <>
              <Link
                href="/messages"
                className="flex items-center gap-1 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground hover:text-foreground sm:hidden"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> All conversations
              </Link>
              <div className="flex min-h-0 flex-1 flex-col">
                <ChatWindow
                  viewerProfileId={viewerProfile.id}
                  counterpart={validCounterpart}
                  initialMessages={initialMessages}
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
