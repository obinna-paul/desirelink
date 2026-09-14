import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDiscoverFilters, searchDiscoverProfiles } from "@/lib/discover";

/** Backs Discover's infinite scroll (components/discover/discover-infinite-grid.tsx) - the
 * initial page is server-rendered by app/(app)/discover/page.tsx as usual, this route only
 * serves every page after that. Takes the exact same filter query params as the page itself
 * plus `offset`, so the client can just append its own current search string. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      profileType: true,
      locationLat: true,
      locationLng: true,
      specTestResults: { select: { specType: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const url = new URL(req.url);
  const searchParams: Record<string, string | string[]> = {};
  for (const key of Array.from(new Set(url.searchParams.keys()))) {
    const values = url.searchParams.getAll(key);
    searchParams[key] = values.length > 1 ? values : values[0];
  }

  const filters = parseDiscoverFilters(searchParams);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  // Search results (filters.query set) are a different surface (SearchResults, mixing
  // posts/hashtags/services) - this endpoint only ever paginates the plain profile grid.
  if (filters.query) {
    return NextResponse.json({ error: "Not supported for search queries" }, { status: 400 });
  }

  const { profiles, hasMore } = await searchDiscoverProfiles(filters, viewerProfile, offset);
  return NextResponse.json({ profiles, hasMore });
}
