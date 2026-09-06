import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ChevronLeft } from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site-config";
import { publicPageMetadata, serializeJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Article not found" };

  return {
    ...publicPageMetadata({
      title: post.title,
      description: post.description,
      path: `/blog/${post.slug}`,
      type: "article",
    }),
    authors: [{ name: post.author }],
    openGraph: {
      siteName: SITE_NAME,
      title: post.title,
      description: post.description,
      type: "article",
      url: absoluteUrl(`/blog/${post.slug}`),
      publishedTime: post.publishedAt,
      authors: [post.author],
      images: [{ url: absoluteUrl("/og-image.png"), width: 1200, height: 630, alt: post.title }],
    },
  };
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${absoluteUrl(`/blog/${post.slug}`)}#article`,
    url: absoluteUrl(`/blog/${post.slug}`),
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    image: absoluteUrl("/og-image.png"),
    inLanguage: "en",
    author: { "@type": "Organization", name: post.author, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png") },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Udala", item: absoluteUrl("/landing") },
      { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
      { "@type": "ListItem", position: 3, name: post.title, item: absoluteUrl(`/blog/${post.slug}`) },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />

        <Link
          href="/blog"
          className="flex w-fit min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> All posts
        </Link>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 px-2.5 py-1 font-medium uppercase tracking-wide text-neon-pink">
              {post.category}
            </span>
            <span>{formatDate(post.publishedAt)}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{post.readTimeMinutes} min read</span>
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>
          <p className="text-sm text-muted-foreground">By {post.author}</p>
        </header>

        <article className="prose prose-invert max-w-none prose-headings:font-heading prose-a:text-neon-pink">
          <MDXRemote source={post.content} />
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}
