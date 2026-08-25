import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export type BlogFrontmatter = {
  title: string;
  description: string;
  publishedAt: string;
  author: string;
  category: string;
};

export type BlogPostSummary = BlogFrontmatter & {
  slug: string;
  readTimeMinutes: number;
};

export type BlogPost = BlogPostSummary & {
  content: string;
};

function readTimeFor(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function slugsOnDisk(): string[] {
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

export function getAllPosts(): BlogPostSummary[] {
  return slugsOnDisk()
    .map((slug) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, `${slug}.mdx`), "utf8");
      const { data, content } = matter(raw);
      const frontmatter = data as BlogFrontmatter;
      return { ...frontmatter, slug, readTimeMinutes: readTimeFor(content) };
    })
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const frontmatter = data as BlogFrontmatter;

  return { ...frontmatter, slug, readTimeMinutes: readTimeFor(content), content };
}

export function getAllSlugs(): string[] {
  return slugsOnDisk();
}
