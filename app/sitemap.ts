import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const MAX_ENTITIES_PER_TYPE = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/landing`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/spec-test`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/help`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.publishedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const [profileResult, listingResult, postResult] = await Promise.allSettled([
    prisma.profile.findMany({
      where: { isSuspended: false, isIncognito: false, showInSearch: true },
      select: { username: true, updatedAt: true },
      take: MAX_ENTITIES_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.serviceListing.findMany({
      where: {
        isActive: true,
        provider: { isSuspended: false, isIncognito: false, showInSearch: true },
      },
      select: { id: true, updatedAt: true },
      take: MAX_ENTITIES_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.post.findMany({
      where: {
        isArchived: false,
        isSubscriberOnly: false,
        author: { isSuspended: false, isIncognito: false, showInSearch: true },
      },
      select: { id: true, updatedAt: true },
      take: MAX_ENTITIES_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const profiles = profileResult.status === "fulfilled" ? profileResult.value : [];
  const listings = listingResult.status === "fulfilled" ? listingResult.value : [];
  const posts = postResult.status === "fulfilled" ? postResult.value : [];

  const profileRoutes: MetadataRoute.Sitemap = profiles.map((profile) => ({
    url: `${SITE_URL}/profile/${encodeURIComponent(profile.username)}`,
    lastModified: profile.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const serviceRoutes: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}/services/${listing.id}`,
    lastModified: listing.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/posts/${post.id}`,
    lastModified: post.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...blogRoutes, ...profileRoutes, ...serviceRoutes, ...postRoutes];
}
