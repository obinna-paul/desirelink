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
    "/((?!login|signup|landing|offline|api/auth|api/signup|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|fallback-.*\\.js|icons/.*|udala-logo.png).*)",
  ],
};
