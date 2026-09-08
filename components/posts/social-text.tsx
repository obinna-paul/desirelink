"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";

const SOCIAL_TOKEN_PATTERN = new RegExp(
  "(^|[^\\p{L}\\p{M}\\p{N}_])(?:#([\\p{L}\\p{M}\\p{N}_]{1,50})(?![\\p{L}\\p{M}\\p{N}_])|@([a-z0-9_][a-z0-9._]{1,18}[a-z0-9_])(?=$|[^a-z0-9_]))",
  "giu",
);

function recordHashtagOpen(tag: string) {
  const storageKey = `udala:hashtag-open:${tag}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // Navigation still works when privacy settings disable session storage.
  }

  void fetch("/api/hashtags/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
    keepalive: true,
  });
}

export function SocialText({ content }: { content: string }) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of Array.from(content.matchAll(SOCIAL_TOKEN_PATTERN))) {
    const matchIndex = match.index ?? 0;
    const prefix = match[1] ?? "";
    const tokenIndex = matchIndex + prefix.length;
    if (tokenIndex > lastIndex) nodes.push(content.slice(lastIndex, tokenIndex));

    const hashtag = match[2];
    const username = match[3]?.toLowerCase();
    if (hashtag) {
      const tag = hashtag.normalize("NFKC").toLowerCase();
      nodes.push(
        <Link
          key={`hashtag-${tokenIndex}`}
          href={`/hashtag/${encodeURIComponent(tag)}`}
          onClick={() => recordHashtagOpen(tag)}
          className="font-semibold not-italic text-primary hover:underline"
        >
          #{hashtag}
        </Link>,
      );
    } else if (username) {
      nodes.push(
        <Link
          key={`mention-${tokenIndex}`}
          href={`/profile/${encodeURIComponent(username)}`}
          className="font-semibold not-italic text-primary hover:underline"
        >
          @{match[3]}
        </Link>,
      );
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));
  return <Fragment>{nodes}</Fragment>;
}
