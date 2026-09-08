import { normalizeUsername } from "@/lib/username-format";

const MENTION_PATTERN = new RegExp(
  "(^|[^\\p{L}\\p{M}\\p{N}_])@([a-z0-9_][a-z0-9._]{1,18}[a-z0-9_])(?=$|[^a-z0-9_])",
  "giu",
);
const MENTION_FRAGMENT_PATTERN = new RegExp(
  "(?:^|[^\\p{L}\\p{M}\\p{N}_])@([a-z0-9._]{0,20})$",
  "iu",
);

export const MAX_MENTIONS_PER_CONTENT = 10;

export type ActiveMention = {
  query: string;
  start: number;
  end: number;
};

export function extractMentionUsernames(content: string): string[] {
  const usernames = new Set<string>();
  for (const match of Array.from(content.matchAll(MENTION_PATTERN))) {
    if (usernames.size >= MAX_MENTIONS_PER_CONTENT) break;
    usernames.add(normalizeUsername(match[2]));
  }
  return Array.from(usernames);
}

export function getActiveMention(value: string, caret: number): ActiveMention | null {
  const safeCaret = Math.max(0, Math.min(caret, value.length));
  const beforeCaret = value.slice(0, safeCaret);
  const match = MENTION_FRAGMENT_PATTERN.exec(beforeCaret);
  if (!match) return null;

  const atOffset = match[0].lastIndexOf("@");
  return {
    query: normalizeUsername(match[1] ?? ""),
    start: (match.index ?? 0) + atOffset,
    end: safeCaret,
  };
}

export function replaceActiveMention(
  value: string,
  active: ActiveMention,
  username: string,
): { value: string; caret: number } {
  const normalized = normalizeUsername(username);
  const replacement = `@${normalized}${/\s/.test(value[active.end] ?? "") ? "" : " "}`;
  const nextValue = `${value.slice(0, active.start)}${replacement}${value.slice(active.end)}`;
  return { value: nextValue, caret: active.start + replacement.length };
}
