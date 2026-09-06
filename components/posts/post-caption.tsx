"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

const TRUNCATE_LENGTH = 150;
const HASHTAG_PATTERN = /#([a-zA-Z0-9_]{1,50})/g;

/** Splits caption text on #hashtags and turns each into a link to its hashtag page,
 * leaving everything else as plain text. */
function linkifyHashtags(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of Array.from(text.matchAll(HASHTAG_PATTERN))) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    nodes.push(
      <Link
        key={index}
        href={`/hashtag/${match[1].toLowerCase()}`}
        className="font-semibold not-italic text-primary hover:underline"
      >
        {match[0]}
      </Link>,
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes;
}

export function PostCaption({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > TRUNCATE_LENGTH;
  const displayText = expanded || !isLong ? content : content.slice(0, TRUNCATE_LENGTH).trimEnd();

  return (
    <p className="font-heading whitespace-pre-wrap px-3 text-[14.5px] italic leading-6 md:px-4">
      {linkifyHashtags(displayText)}
      {isLong && (expanded ? " " : "… ")}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="font-semibold text-muted-foreground hover:text-foreground"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </p>
  );
}
