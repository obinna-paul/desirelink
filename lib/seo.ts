import type { Metadata } from "next";

import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/site-config";

export const PUBLIC_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  noarchive: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

export function seoDescription(value: string | null | undefined, fallback: string, maxLength = 160): string {
  const normalized = (value || fallback).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const shortened = normalized.slice(0, maxLength - 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > maxLength * 0.7 ? lastSpace : shortened.length).trimEnd()}…`;
}

export function publicPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article" | "profile";
}): Metadata {
  const canonical = absoluteUrl(path);
  const selectedImage = image || DEFAULT_OG_IMAGE;
  const resolvedImage = absoluteUrl(selectedImage);
  const isDefaultImage = selectedImage === DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical },
    robots: PUBLIC_ROBOTS,
    openGraph: {
      type,
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
      images: [
        {
          url: resolvedImage,
          ...(isDefaultImage ? { width: 1200, height: 630 } : {}),
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [resolvedImage],
    },
  };
}

/** Prevent user-authored text from closing the JSON-LD script element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
