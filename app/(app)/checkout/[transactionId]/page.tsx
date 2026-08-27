import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { MockCheckout } from "@/components/checkout/mock-checkout";

export default async function CheckoutPage({
  params,
}: {
  params: { transactionId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    redirect("/login");
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: params.transactionId },
    include: {
      tier: {
        select: {
          name: true,
          creator: { select: { username: true, displayName: true } },
        },
      },
      event: {
        select: { id: true, title: true, host: { select: { displayName: true } } },
      },
    },
  });

  if (!transaction || transaction.userId !== profile.id) {
    notFound();
  }

  if (transaction.event) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="hidden md:block">
          <PageHeader title="Checkout" description="Mock payment - no real charge is made." />
        </div>
        <div className="md:hidden">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Checkout
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Confirm your mock payment.</p>
        </div>
        <MockCheckout
          transactionId={transaction.id}
          status={transaction.status}
          kind="event"
          tierName={transaction.event.title}
          creatorName={transaction.event.host.displayName}
          creatorUsername={null}
          amountCents={transaction.amountCents}
          backHref={`/events/${transaction.event.id}`}
          backLabel="Back to event"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Checkout" description="Mock payment - no real charge is made." />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirm your mock payment.</p>
      </div>
      <MockCheckout
        transactionId={transaction.id}
        status={transaction.status}
        tierName={transaction.tier?.name ?? "Membership"}
        creatorName={transaction.tier?.creator.displayName ?? "Creator"}
        creatorUsername={transaction.tier?.creator.username ?? null}
        amountCents={transaction.amountCents}
        backHref={
          transaction.tier?.creator.username
            ? `/profile/${transaction.tier.creator.username}?section=membership`
            : undefined
        }
      />
    </div>
  );
}
