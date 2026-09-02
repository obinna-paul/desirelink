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
    // and service listings — these need to render for logged-out visitors and
    // search engine crawlers (neither carries an auth cookie) so shared links
    // and SEO indexing actually work. Each exclusion carves out only the
    // dynamic `[id]`/`[username]` segment, not its static sibling routes
    // (`/profile/edit`, `/services/new`, `/services/bookings`), which stay
    // auth-gated as before.
    "/((?!login|signup|landing|blog|help|offline|api/auth|api/signup|_next/static|_next/image|icons/.*|profile/(?!edit(?:/|$))[^/]+|posts/[^/]+|services/(?!new(?:/|$)|bookings(?:/|$))[^/]+|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|json|js|css|woff2?|txt|xml)$).+)",
  ],
};
