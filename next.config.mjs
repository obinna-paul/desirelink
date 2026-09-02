import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  fallbacks: {
    document: "/offline",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  // lib/blog.ts reads content/*.mdx at runtime via fs.readdirSync/readFileSync
  // with a computed path, which Next's build-time file tracer can't always
  // follow — without this, routes that reach it (sitemap.xml, /blog, /blog/[slug])
  // get deployed without the content directory bundled and 500 with ENOENT on Vercel.
  experimental: {
    outputFileTracingIncludes: {
      "/sitemap.xml": ["content/blog/**"],
      "/blog": ["content/blog/**"],
      "/blog/[slug]": ["content/blog/**"],
    },
  },
};

export default withPWA(nextConfig);
