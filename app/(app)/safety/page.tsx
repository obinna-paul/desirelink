import Link from "next/link";
import { ChevronRight, Flag, ShieldOff } from "lucide-react";

const SAFETY_LINKS = [
  {
    href: "/safety/blocked",
    label: "Blocked users",
    description: "See and manage the people you've blocked.",
    icon: ShieldOff,
  },
  {
    href: "/safety/reports",
    label: "Report history",
    description: "Track the reports you've submitted and their status.",
    icon: Flag,
  },
];

export default function SafetyCenterPage() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ul className="flex flex-col gap-2">
        {SAFETY_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm transition-colors hover:border-neon-pink/60 md:rounded-xl md:p-4 md:shadow-none"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <link.icon className="h-5 w-5 text-neon-pink" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{link.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
