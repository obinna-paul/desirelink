import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";

const MAX_ENTITIES_PER_TYPE = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/landing`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/help`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/signup`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const blogRoutes: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.publishedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const [profiles, events, listings] = await Promise.all([
    prisma.profile.findMany({
      where: { isSuspended: false, isIncognito: false, showInSearch: true },
      select: { username: true, updatedAt: true },
      take: MAX_ENTITIES_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.event.findMany({
      where: { isPrivate: false, endTime: { gt: new Date() } },
      select: { id: true, updatedAt: true },
      take: MAX_ENTITIES_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.serviceListing.findMany({
      where: { provider: { isSuspended: false } },
      select: { id: true, updatedAt: true },
      take: MAX_ENTITIES_PER_TYPE,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const profileRoutes: MetadataRoute.Sitemap = profiles.map((profile) => ({
    url: `${SITE_URL}/profile/${profile.username}`,
    lastModified: profile.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const eventRoutes: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${SITE_URL}/events/${event.id}`,
    lastModified: event.updatedAt,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  const serviceRoutes: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}/services/${listing.id}`,
    lastModified: listing.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...blogRoutes, ...profileRoutes, ...eventRoutes, ...serviceRoutes];
}
