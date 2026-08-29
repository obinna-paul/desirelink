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
    "/((?!login|signup|landing|blog|help|offline|api/auth|api/signup|_next/static|_next/image|icons/.*|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|json|js|css|woff2?|txt|xml)$).+)",
  ],
};
