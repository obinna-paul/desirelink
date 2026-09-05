"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `menu` renders this as a full-width labeled row (for the profile page's "..." menu,
 * the only sign-out path on mobile) instead of the icon-only button used in the desktop
 * top-bar - same dual-mode pattern as BlockButton. */
export function SignOutButton({ menu = false }: { menu?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={menu ? "sm" : "icon"}
      aria-label="Sign out"
      className={cn(menu && "min-h-11 w-full justify-start gap-1.5 rounded-lg px-3 text-sm font-medium")}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className={cn("h-5 w-5", menu && "h-4 w-4")} aria-hidden="true" />
      {menu && "Log out"}
    </Button>
  );
}
