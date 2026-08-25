import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-border/60 px-4 py-8 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-8">
      <span>&copy; {new Date().getFullYear()} Udala. All rights reserved.</span>
      <nav className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/blog" className="flex min-h-11 items-center hover:text-foreground">
          Blog
        </Link>
        <Link href="/login" className="flex min-h-11 items-center hover:text-foreground">
          Log in
        </Link>
        <Link href="/signup" className="flex min-h-11 items-center hover:text-foreground">
          Sign up
        </Link>
      </nav>
    </footer>
  );
}
