"use client";

import { useState } from "react";

const TRUNCATE_LENGTH = 150;

export function PostCaption({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > TRUNCATE_LENGTH;
  const displayText = expanded || !isLong ? content : content.slice(0, TRUNCATE_LENGTH).trimEnd();

  return (
    <p className="whitespace-pre-wrap px-3 text-sm leading-6 md:px-4">
      {displayText}
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
