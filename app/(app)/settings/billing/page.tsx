import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBillingOverview } from "@/lib/billing";
import { confirmProviderPayment } from "@/lib/providers";
import { formatCents } from "@/lib/creator";
import { PaymentMethodManager } from "@/components/billing/PaymentMethodManager";
import { CancelProviderSubButton } from "@/components/billing/BillingActions";

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: { reference?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!profile) {
    redirect("/login");
  }

  if (searchParams.reference) {
    await confirmProviderPayment(searchParams.reference);
  }

  const overview = await getBillingOverview(profile.id);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Provider subscriptions</h2>
        {overview.providerSubscriptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-6 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
            You&apos;re not subscribed to any providers yet.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.providerSubscriptions.map((sub) => (
              <li
                key={sub.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:rounded-xl md:shadow-none"
              >
                <div>
                  <p className="text-sm font-medium">
                    {sub.providerDisplayName} &middot; {sub.tierName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sub.status}
                    {sub.cancelAtPeriodEnd && " (cancels at period end)"} &middot; renews {sub.endsAt.toLocaleDateString()}
                  </p>
                </div>
                {sub.status === "active" && !sub.cancelAtPeriodEnd && (
                  <CancelProviderSubButton providerId={sub.providerId} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Payment methods</h2>
        <PaymentMethodManager initialCards={overview.paymentMethods} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Billing history</h2>
        {overview.transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-6 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:shadow-none">
            No charges yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
            <table className="min-w-[640px] border-collapse text-left text-sm md:w-full">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Description
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2">{transaction.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-2">{transaction.description}</td>
                    <td className="px-4 py-2 tabular-nums">{formatCents(transaction.amountCents)}</td>
                    <td className="px-4 py-2 capitalize">{transaction.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
