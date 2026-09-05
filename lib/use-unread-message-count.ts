"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";

import { getPusherClient } from "@/lib/pusher-client";
import { getUserChannelName, INBOX_UPDATED_EVENT } from "@/lib/message-channels";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load unread message count");
  return response.json() as Promise<{ count: number }>;
};

/**
 * Powers the unread-conversation counter badge on the Messages nav icon (see
 * bottom-nav.tsx / sidebar-nav.tsx) - a thread count, not a raw message count, so it
 * behaves like WhatsApp's: +1 per new conversation with unread activity, -1 as each
 * thread gets opened and read.
 *
 * Polls as a baseline, plus two triggers for near-instant updates: a Pusher event on
 * the viewer's own channel when a new message arrives (increments), and a refetch
 * whenever the route changes (catches messages getting marked read on /messages,
 * without the conversation page needing to know about this badge at all).
 */
export function useUnreadMessageCount(viewerProfileId: string | null): number {
  const pathname = usePathname();
  const { data, mutate } = useSWR<{ count: number }>(
    viewerProfileId ? "/api/messages/unread-count" : null,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true }
  );

  useEffect(() => {
    if (!viewerProfileId) return;
    const client = getPusherClient();
    if (!client) return;

    const channelName = getUserChannelName(viewerProfileId);
    const channel = client.subscribe(channelName);
    channel.bind(INBOX_UPDATED_EVENT, () => void mutate());

    return () => {
      channel.unbind(INBOX_UPDATED_EVENT);
      client.unsubscribe(channelName);
    };
  }, [viewerProfileId, mutate]);

  useEffect(() => {
    void mutate();
  }, [pathname, mutate]);

  return data?.count ?? 0;
}
