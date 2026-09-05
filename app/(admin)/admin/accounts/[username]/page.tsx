import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAdminContext } from "@/lib/admin/access";
import { getAccountDetail } from "@/lib/admin/accounts";
import { AccountRecord, type AccountRecordData } from "@/components/admin/account-record";

export const dynamic = "force-dynamic";

export default async function AdminAccountDetailPage({
  params,
}: {
  params: { username: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const context = await getAdminContext(session.user.id);
  if (!context.isAdmin || !context.capabilities.has("view_accounts")) {
    notFound();
  }

  const detail = await getAccountDetail(params.username);
  if (!detail) {
    notFound();
  }

  // Server -> Client component props are serialized through the RSC payload; converting
  // Date fields to ISO strings here matches how the rest of the app hands data across that
  // boundary (see lib/posts.ts's toPostView) rather than relying on Date surviving the trip.
  const data: AccountRecordData = {
    profile: {
      ...detail.profile,
      suspendedAt: detail.profile.suspendedAt?.toISOString() ?? null,
      createdAt: detail.profile.createdAt.toISOString(),
    },
    stats: detail.stats,
    recentTransactions: detail.recentTransactions.map((t) => ({
      id: t.id,
      amountCents: t.amountCents,
      status: t.status,
      provider: t.provider,
      createdAt: t.createdAt.toISOString(),
    })),
    pendingWithdrawals: detail.pendingWithdrawals.map((w) => ({
      id: w.id,
      netAmountCents: w.netAmountCents,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    })),
    notes: detail.notes.map((note) => ({
      id: note.id,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      author: { name: note.author.name, email: note.author.email },
    })),
    adminHistory: detail.adminHistory.map((entry) => ({
      id: entry.id,
      action: entry.action,
      summary: entry.summary,
      createdAt: entry.createdAt.toISOString(),
      actor: { name: entry.actor.name, email: entry.actor.email },
    })),
    posts: detail.posts.map((post) => ({
      id: post.id,
      isSubscriberOnly: post.isSubscriberOnly,
      viewCount: post.viewCount,
      reactionCount: post._count.reactions,
      commentCount: post._count.comments,
      createdAt: post.createdAt.toISOString(),
    })),
    serviceListings: detail.serviceListings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      priceCents: listing.priceCents,
      createdAt: listing.createdAt.toISOString(),
    })),
  };

  return (
    <AccountRecord
      detail={data}
      canModerate={context.capabilities.has("moderate_content")}
      canWriteNotes={context.capabilities.has("write_notes")}
      canDelete={context.capabilities.has("delete_accounts")}
    />
  );
}
