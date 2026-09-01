import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/admin/",
        "/messages",
        "/settings",
        "/settings/",
        "/wallet",
        "/creator-dashboard",
        "/onboarding/",
        "/live/go",
        "/events/manage",
        "/events/manage/",
        "/services/new",
        "/profile/edit",
        "/safety/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
