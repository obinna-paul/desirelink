"use client";

import { memo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BadgeCheck, Clock, Loader2, ShieldAlert, Upload, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { VerificationRequestType } from "@/lib/verification";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const LABELS: Record<VerificationRequestType, string> = {
  creator: "creator",
  host: "host",
};

const FileSlot = memo(function FileSlot({
  label,
  url,
  uploading,
  onPick,
  onClear,
}: {
  label: string;
  url: string;
  uploading: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {url ? (
          <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-border/60 bg-secondary">
            <Image src={url} alt="" fill sizes="6rem" className="object-cover" />
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()}`}
              onClick={onClear}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors hover:bg-background"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-border/60 text-[10px] text-muted-foreground">
            No image
          </div>
        )}
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
    </div>
  );
});

export function VerificationRequestCard({
  requestType,
  isVerified,
  latestStatus,
  ineligibleMessage,
}: {
  requestType: VerificationRequestType;
  isVerified: boolean;
  latestStatus: "pending" | "approved" | "denied" | null;
  ineligibleMessage?: string;
}) {
  const router = useRouter();
  const idInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [govIdUrl, setGovIdUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = LABELS[requestType];

  async function uploadFile(
    file: File,
    endpoint: string,
    setUploading: (value: boolean) => void,
    setUrl: (value: string) => void
  ) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be under 5MB.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Upload failed. Please try again.");
        return;
      }
      setUrl(body.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!govIdUrl || !selfieUrl) {
      setError("Upload both a government ID and a selfie.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType, govIdUrl, selfieUrl }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.refresh();
  }

  if (isVerified) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-4">
        <BadgeCheck className="h-5 w-5 shrink-0 text-neon-pink" aria-hidden="true" />
        <div className="flex items-center gap-2 text-sm">
          <span>You&rsquo;re a verified {label}.</span>
          <Badge variant="neon">Verified {label}</Badge>
        </div>
      </div>
    );
  }

  if (latestStatus === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-4">
        <Clock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Your {label} verification request is pending review.
        </p>
      </div>
    );
  }

  if (ineligibleMessage) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-card p-4">
        <ShieldAlert className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{ineligibleMessage}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">Request {label} verification</h3>
        <p className="text-xs text-muted-foreground">
          Upload a government ID and a selfie. We don&rsquo;t process real ID documents in this environment —
          this just flags your request for manual review.
        </p>
        {latestStatus === "denied" && (
          <p className="mt-1 text-xs text-destructive">
            Your last request was denied. You can submit a new one below.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-6">
        <FileSlot
          label="Government ID"
          url={govIdUrl}
          uploading={uploadingId}
          onPick={() => idInputRef.current?.click()}
          onClear={() => setGovIdUrl("")}
        />
        <FileSlot
          label="Selfie"
          url={selfieUrl}
          uploading={uploadingSelfie}
          onPick={() => selfieInputRef.current?.click()}
          onClear={() => setSelfieUrl("")}
        />
      </div>

      <input
        ref={idInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file, "/api/upload/verification-id", setUploadingId, setGovIdUrl);
        }}
      />
      <input
        ref={selfieInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file, "/api/upload/verification-selfie", setUploadingSelfie, setSelfieUrl);
        }}
      />

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || uploadingId || uploadingSelfie}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md bg-gradient-to-r from-neon-pink to-neon-cyan px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit for review"}
      </button>
    </form>
  );
}
