"use client";

import { useState } from "react";
import Image from "next/image";
import { Expand, Lock, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MediaLightbox, type LightboxMedia } from "@/components/admin/media-lightbox";

/** Kept local rather than imported from lib/admin/content.ts (server-only) - see the same
 * pattern/reasoning in account-record.tsx. */
const CONTENT_ACCESS_REASONS = [
  "Investigating a report",
  "Quality control review",
  "Verification review",
  "Legal or law-enforcement request",
  "Other",
] as const;

type MediaItem = { url: string; type: "image" | "video" };

export function LockedContentViewer({
  postId,
  authorUsername,
}: {
  postId: string;
  authorUsername: string;
}) {
  const [reason, setReason] = useState<(typeof CONTENT_ACCESS_REASONS)[number] | "">("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<{ content: string; media: MediaItem[] } | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia>(null);

  async function openContent() {
    if (!reason) {
      setError("Select a reason first.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/content/posts/${postId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, detail: detail.trim() || undefined }),
    });
    const body = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(body?.error ?? "Couldn't open this content.");
      return;
    }
    setContent(body.post);
  }

  if (content) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>This view of @{authorUsername}&apos;s paid content was recorded in the audit log.</p>
        </div>

        {content.media.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {content.media.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setLightboxMedia(item)}
                aria-label={`View full size ${item.type}`}
                className="group relative aspect-square w-full overflow-hidden rounded-lg bg-secondary"
              >
                {item.type === "video" ? (
                  <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  <Image src={item.url} alt="" fill sizes="200px" className="object-cover" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  <Expand className="h-5 w-5 text-white" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        )}

        {content.content && <p className="whitespace-pre-wrap text-sm">{content.content}</p>}

        <MediaLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          This is paid subscriber content. Opening it is recorded in the audit log against your account.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason for access</legend>
        {CONTENT_ACCESS_REASONS.map((option) => (
          <label key={option} className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="radio"
              name="reason"
              value={option}
              checked={reason === option}
              onChange={() => setReason(option)}
              className="h-4 w-4"
            />
            {option}
          </label>
        ))}
      </fieldset>

      {reason === "Other" && (
        <input
          type="text"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Describe why..."
          maxLength={500}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary/60"
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="button" size="sm" disabled={loading || !reason} onClick={openContent} className="self-start">
        {loading ? "Opening..." : "Open content"}
      </Button>
    </div>
  );
}
