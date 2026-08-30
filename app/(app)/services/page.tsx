import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { BriefcaseBusiness } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ServiceListingGrid } from "@/components/home/service-listing-grid";
import { getHomeServiceListings } from "@/lib/service-listings";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const listings = await getHomeServiceListings(24);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <PageHeader title="Services" description="Book a paid service from a provider." />
      </div>
      <div className="md:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Services</h1>
        <p className="mt-1 text-sm text-muted-foreground">Book a paid service from a provider.</p>
      </div>

      <div>
        <Button asChild variant="outline" className="gap-1.5">
          <Link href="/create?type=service">
            <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" /> List a service
          </Link>
        </Button>
      </div>

      <ServiceListingGrid
        listings={listings}
        emptyMessage="No services are listed yet. Create a service when you are ready to offer one."
      />
    </div>
  );
}
