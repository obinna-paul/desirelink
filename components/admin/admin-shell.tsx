"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScrollText, ShieldAlert, type LucideIcon } from "lucide-react";

import type { AdminRole } from "@/lib/admin/access";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omit to show for every admin role - the layout already gated isAdmin. */
  requiresRole?: AdminRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldAlert, requiresRole: ["MODERATOR", "SUPERADMIN"] },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, requiresRole: ["SUPERADMIN"] },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  SUPPORT: "Support",
  MODERATOR: "Moderator",
  FINANCE: "Finance",
  SUPERADMIN: "Superadmin",
};

export function AdminShell({
  role,
  adminName,
  adminEmail,
  children,
}: {
  role: AdminRole;
  adminName: string;
  adminEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.requiresRole || item.requiresRole.includes(role));

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className="shrink-0 border-b border-border bg-card md:sticky md:top-0 md:h-dvh md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5 md:border-b-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            U
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">Udala Admin</p>
            <p className="truncate text-[10px] leading-tight text-muted-foreground">{ROLE_LABELS[role]}</p>
          </div>
        </div>

        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:overflow-visible md:px-3 md:py-4">
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                  active ? "bg-accent-tint text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden border-t border-border px-4 py-3 md:block">
          <p className="truncate text-xs font-medium">{adminName}</p>
          <p className="truncate text-[11px] text-muted-foreground">{adminEmail}</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 md:gap-6">{children}</div>
      </main>
    </div>
  );
}
