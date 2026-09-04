import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    // NOTE: the trailing `\\.[\\w]+$` / extension exclusion matters — the Next.js
    // image optimizer fetches source images server-side WITHOUT the user's auth
    // cookie, so any public asset the matcher doesn't exclude gets redirected to
    // /login (307) and the optimizer returns 400. Exclude all static file
    // extensions so images, fonts, and manifests are never auth-gated.
    //
    // Also excluded: the individual public detail routes for profiles, posts,
    // service listings, and live streams — these need to render for logged-out
    // visitors and search engine crawlers (neither carries an auth cookie) so
    // shared links and SEO indexing actually work. Each exclusion carves out
    // only the dynamic `[id]`/`[username]` segment, not its static sibling
    // routes (`/profile/edit`, `/services/new`, `/services/bookings`,
    // `/live/go`), which stay auth-gated as before. A scheduled/live stream's
    // link is meant to be shared on Twitter/Instagram before the recipient has
    // an account, same reasoning as the other three.
    //
    // Also excluded: api/cron/* — Vercel's cron invoker (and any external
    // pinger hitting these) never carries a user session cookie, only the
    // CRON_SECRET bearer token each route checks itself via isCronAuthorized.
    // Without this exclusion every cron hit 307-redirects to /login instead of
    // running - confirmed live for the pre-existing daily crons too, not just
    // the one added here, so this was a standing bug, not new behavior.
    "/((?!login|signup|landing|blog|help|offline|api/auth|api/signup|api/cron|_next/static|_next/image|icons/.*|profile/(?!edit(?:/|$))[^/]+|posts/[^/]+|services/(?!new(?:/|$)|bookings(?:/|$))[^/]+|live/(?!go(?:/|$))[^/]+|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|json|js|css|woff2?|txt|xml)$).+)",
  ],
};
