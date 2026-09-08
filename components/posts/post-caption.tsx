"use client";

import { useState } from "react";

import { SocialText } from "@/components/posts/social-text";

const TRUNCATE_LENGTH = 150;
export function PostCaption({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > TRUNCATE_LENGTH;
  const draft = content.slice(0, TRUNCATE_LENGTH);
  const naturalBreak = Math.max(draft.lastIndexOf(" "), draft.lastIndexOf("\n"));
  const collapsedText = draft.slice(0, naturalBreak >= 120 ? naturalBreak : TRUNCATE_LENGTH).trimEnd();
  const displayText = expanded || !isLong ? content : collapsedText;

  return (
    <p className="font-heading whitespace-pre-wrap px-3 text-[14.5px] italic leading-6 md:px-4">
      <SocialText content={displayText} />
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
