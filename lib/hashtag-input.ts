import { normalizeHashtag } from "@/lib/hashtags";

const HASHTAG_FRAGMENT_PATTERN = new RegExp(
  "(?:^|[^\\p{L}\\p{M}\\p{N}_])#([\\p{L}\\p{M}\\p{N}_]*)$",
  "u",
);

export type ActiveHashtag = {
  query: string;
  start: number;
  end: number;
};

/** Returns the hashtag currently being edited at the caret, including a bare `#`. */
export function getActiveHashtag(value: string, caret: number): ActiveHashtag | null {
  const safeCaret = Math.max(0, Math.min(caret, value.length));
  const beforeCaret = value.slice(0, safeCaret);
  const match = HASHTAG_FRAGMENT_PATTERN.exec(beforeCaret);
  if (!match) return null;

  const hashOffset = match[0].lastIndexOf("#");
  const start = (match.index ?? 0) + hashOffset;
  return {
    query: normalizeHashtag(match[1] ?? ""),
    start,
    end: safeCaret,
  };
}

export function replaceActiveHashtag(
  value: string,
  active: ActiveHashtag,
  tag: string,
): { value: string; caret: number } {
  const normalized = normalizeHashtag(tag);
  const replacement = `#${normalized}${/\s/.test(value[active.end] ?? "") ? "" : " "}`;
  const nextValue = `${value.slice(0, active.start)}${replacement}${value.slice(active.end)}`;
  return { value: nextValue, caret: active.start + replacement.length };
}
