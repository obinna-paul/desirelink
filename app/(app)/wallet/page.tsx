import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { getWalletOverview, MINIMUM_WITHDRAWAL_CENTS, WALLET_WITHDRAWAL_FEE_RATE } from "@/lib/wallet";
import { confirmHeartsPurchase } from "@/lib/hearts";
import { formatCents } from "@/lib/creator";
import { BuyHeartsPanel } from "@/components/wallet/buy-hearts-panel";
import { WithdrawWalletButton } from "@/components/wallet/withdraw-wallet-button";
import { PayoutSetup } from "@/components/provider/PayoutSetup";

const GIFT_CONTEXT_LABEL: Record<string, string> = {
  live_stream: "during your live stream",
  profile: "on your profile",
  chat: "in chat",
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: { reference?: string; mock_reference?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    redirect("/login");
  }

  const reference = searchParams.reference ?? searchParams.mock_reference;
  if (reference) {
    await confirmHeartsPurchase(reference);
  }

  const overview = await getWalletOverview(profile.id);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Wallet" description="Buy hearts to send gifts, and withdraw what you've earned." />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hearts, gifts, and payouts.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Heart className="h-5 w-5 text-neon-pink" aria-hidden="true" fill="currentColor" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Hearts balance</p>
            <p className="text-lg font-semibold">{overview.heartsBalance.toLocaleString()}</p>
          </div>
        </div>

        {overview.isProvider && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4">
            <div>
              <p className="text-xs text-muted-foreground">Wallet balance</p>
              <p className="text-lg font-semibold">{formatCents(overview.walletBalanceCents)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                A {Math.round(WALLET_WITHDRAWAL_FEE_RATE * 100)}% fee applies at withdrawal.
              </p>
            </div>
            <WithdrawWalletButton
              disabled={!overview.payoutReady || overview.walletBalanceCents < MINIMUM_WITHDRAWAL_CENTS}
            />
          </div>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Buy hearts</h2>
        <BuyHeartsPanel />
      </section>

      {overview.isProvider && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Payout details</h2>
          <PayoutSetup providerId={profile.id} />
        </section>
      )}

      {overview.isProvider && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Gifts received</h2>
          {overview.giftsReceived.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No gifts yet — they show up here the moment someone sends you one.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {overview.giftsReceived.map((gift) => (
                <li
                  key={gift.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 text-sm"
                >
                  <span>
                    <span className="font-medium">{gift.sender.displayName}</span> sent {gift.hearts.toLocaleString()}{" "}
                    hearts {GIFT_CONTEXT_LABEL[gift.context] ?? ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatCents(gift.valueCents)} &middot; {formatDistanceToNow(gift.createdAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {overview.isProvider && overview.withdrawals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Withdrawal history</h2>
          <ul className="flex flex-col gap-2">
            {overview.withdrawals.map((withdrawal) => (
              <li
                key={withdrawal.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 text-sm"
              >
                <span>
                  {formatCents(withdrawal.netAmountCents)} sent{" "}
                  <span className="text-xs text-muted-foreground">
                    (from {formatCents(withdrawal.amountCents)}, {formatCents(withdrawal.feeCents)} fee)
                  </span>
                </span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">
                  {withdrawal.status} &middot; {formatDistanceToNow(withdrawal.createdAt, { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Gifts sent</h2>
        {overview.giftsSent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            You haven&apos;t sent any gifts yet. Visit a provider&apos;s profile, chat with them, or join their live
            stream to send one.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.giftsSent.map((gift) => (
              <li
                key={gift.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 text-sm"
              >
                <span>
                  You sent {gift.hearts.toLocaleString()} hearts to{" "}
                  <span className="font-medium">{gift.receiver.displayName}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(gift.createdAt, { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
