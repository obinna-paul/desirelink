import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ShieldCheck } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmServiceBookingPayment, getCustomerBookings, getProviderBookings } from "@/lib/service-bookings";
import { isProviderProfileType } from "@/lib/provider-types";
import { BookingList } from "@/components/services/booking-list";

export const dynamic = "force-dynamic";

export default async function ServiceBookingsPage({
  searchParams,
}: {
  searchParams: { reference?: string; mock_reference?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, profileType: true },
  });
  if (!profile) {
    redirect("/login");
  }

  const reference = searchParams.reference ?? searchParams.mock_reference;
  if (reference) {
    await confirmServiceBookingPayment(reference);
  }

  const isProvider = isProviderProfileType(profile.profileType);
  const [customerBookingsRaw, providerBookingsRaw] = await Promise.all([
    getCustomerBookings(profile.id),
    isProvider ? getProviderBookings(profile.id) : Promise.resolve([]),
  ]);
  const customerBookings = customerBookingsRaw.map((b) => ({ ...b, requestedAt: b.requestedAt.toISOString() }));
  const providerBookings = providerBookingsRaw.map((b) => ({ ...b, requestedAt: b.requestedAt.toISOString() }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10">
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Every booking is escrow-protected</p>
          <p className="text-xs text-muted-foreground">
            Payment is held safely until you confirm the service was delivered — providers are only paid once
            you&apos;re satisfied, or automatically after a short grace period if nothing&apos;s flagged.
          </p>
        </div>
      </div>

      {isProvider && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Requests you&apos;ve received</h2>
          <BookingList role="provider" bookings={providerBookings} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Your bookings</h2>
        <BookingList role="customer" bookings={customerBookings} />
      </section>
    </div>
  );
}
