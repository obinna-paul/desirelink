import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { CreatorDirectoryFiltersPanel } from "@/components/creators/creator-directory-filters";
import { CreatorDirectoryGrid } from "@/components/creators/creator-directory-grid";
import {
  parseCreatorDirectoryFilters,
  searchSubscribableCreators,
  type CreatorDirectorySearchParams,
} from "@/lib/creators-directory";

/**
 * Not linked from any nav - only reachable via the "Find creators" CTA on the home feed's
 * Premium tab (see components/home/find-creators-prompt.tsx).
 */
export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: CreatorDirectorySearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const filters = parseCreatorDirectoryFilters(searchParams);
  const creators = await searchSubscribableCreators(filters);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Find creators</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscribe to a creator to see their premium content in your Premium tab.
        </p>
      </div>

      <CreatorDirectoryFiltersPanel initialFilters={filters} />

      <p className="px-0.5 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{creators.length}</span>{" "}
        {creators.length === 1 ? "creator matches" : "creators match"} {filters.query ? "your search" : "your filters"}
      </p>

      <CreatorDirectoryGrid creators={creators} />
    </div>
  );
}
