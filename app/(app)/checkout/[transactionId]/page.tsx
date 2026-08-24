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
    },
  });

  if (!transaction || transaction.userId !== profile.id) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Checkout" description="Mock payment — no real charge is made." />
      <MockCheckout
        transactionId={transaction.id}
        status={transaction.status}
        tierName={transaction.tier?.name ?? "Membership"}
        creatorName={transaction.tier?.creator.displayName ?? "Creator"}
        creatorUsername={transaction.tier?.creator.username ?? null}
        amountCents={transaction.amountCents}
      />
    </div>
  );
}
