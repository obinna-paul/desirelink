import Link from "next/link";
import type { Metadata } from "next";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "udala Blog",
  description:
    "Guides and updates from udala: how Preferences work, safety and consent, offering services, and growing as a creator.",
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">udala Blog</h1>
          <p className="text-muted-foreground">
            Guides, safety notes, and tips from the team building udala.
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-neon-pink/60"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/60 px-2.5 py-1 font-medium uppercase tracking-wide text-neon-pink">
                    {post.category}
                  </span>
                  <span>{formatDate(post.publishedAt)}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{post.readTimeMinutes} min read</span>
                </div>
                <h2 className="font-heading text-xl font-semibold">{post.title}</h2>
                <p className="text-sm text-muted-foreground">{post.description}</p>
                <span className="text-xs font-medium text-muted-foreground">By {post.author}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <PublicFooter />
    </div>
  );
}
