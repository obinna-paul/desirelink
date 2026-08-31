import type { Profile } from "@prisma/client";
import { BadgeCheck, ShieldCheck } from "lucide-react";

export function VerificationBadge({ profile }: { profile: Profile }) {
  const isVerifiedProvider =
    profile.isVerified ||
    profile.isVerifiedCreator ||
    profile.isVerifiedHost ||
    profile.isVerifiedServiceProvider;

  const badges = [
    isVerifiedProvider && "Verified provider",
    profile.isTrustedMember && "Trusted member",
  ].filter(Boolean) as string[];

  if (badges.length === 0) return null;

  return (
    <span className="relative inline-block align-middle">
      <details className="group">
        <summary className="flex h-6 w-6 cursor-pointer list-none items-center justify-center text-primary [&::-webkit-details-marker]:hidden">
          <BadgeCheck
            className="h-5 w-5 fill-primary text-primary-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Show verification details</span>
        </summary>
        <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-xl border border-border/70 bg-card p-3 shadow-lg">
          <ul className="flex flex-col gap-1.5">
            {badges.map((label) => (
              <li
                key={label}
                className="flex items-center gap-2 text-xs font-medium text-foreground"
              >
                <ShieldCheck
                  className="h-3.5 w-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />{" "}
                {label}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </span>
  );
}
