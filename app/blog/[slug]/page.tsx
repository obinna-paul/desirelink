import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ChevronLeft } from "lucide-react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};

  return {
    title: `${post.title} — Udala Blog`,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
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
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: post.author },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-8">
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
