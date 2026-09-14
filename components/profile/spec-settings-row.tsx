"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Compass } from "lucide-react";

import { SpecTestNudgeModal } from "@/components/spec-test/spec-test-nudge-modal";

// Same visual language as EditProfileForm's own SectionButton (that component isn't
// exported, so this is a standalone match rather than a shared import) - this row sits
// alongside Basics/Photos/Location/etc. in profile settings but behaves differently: taken
// -> links straight to the saved reading; untaken -> opens the nudge popup instead of
// navigating anywhere.
const ROW_CLASSNAME =
  "flex min-h-[64px] w-full items-center gap-3 border-b border-border px-1 py-2 text-left transition-colors last:border-b-0 md:rounded-xl md:border md:border-border md:bg-card md:px-3.5 hover:bg-muted";

function RowContent({ description }: { description: string }) {
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground md:rounded-xl md:border md:border-border md:text-primary">
        <Compass className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">What&rsquo;s your spec?</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );
}

/**
 * "What's your spec?" row for profile settings (see components/profile/edit-profile-form.tsx).
 * `latestSpecResultId` is the id of the profile's most recently linked SpecTestResult, if any
 * (fetched by app/(app)/profile/edit/page.tsx) - null means this profile hasn't taken it.
 */
export function SpecSettingsRow({ latestSpecResultId }: { latestSpecResultId: string | null }) {
  const [nudgeOpen, setNudgeOpen] = useState(false);

  if (latestSpecResultId) {
    return (
      <Link href={`/spec-test/result/${latestSpecResultId}`} className={ROW_CLASSNAME}>
        <RowContent description="See your result" />
      </Link>
    );
  }

  return (
    // A wrapping div, not a fragment: this component's parent lists lay out their rows with
    // `space-y-*`, which only reads directly-owned children - a fragment would expose the
    // fixed-position modal below as a sibling of those rows and give it an unwanted
    // margin-top from that spacing utility.
    <div>
      <button type="button" onClick={() => setNudgeOpen(true)} className={ROW_CLASSNAME}>
        <RowContent description="Find out in 4 minutes" />
      </button>
      {nudgeOpen && <SpecTestNudgeModal variant="settings" onClose={() => setNudgeOpen(false)} />}
    </div>
  );
}
