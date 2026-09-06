"use client";

import { useState } from "react";
import { EyeOff, ThumbsDown, ThumbsUp } from "lucide-react";

import { OverflowMenu } from "@/components/ui/overflow-menu";
import { ReportDialog } from "@/components/safety/report-dialog";
import { cn } from "@/lib/utils";

type FeedbackState = "idle" | "pending" | "done";

function MenuRow({
  icon: Icon,
  label,
  doneLabel,
  onClick,
}: {
  icon: typeof ThumbsUp;
  label: string;
  doneLabel: string;
  onClick: () => Promise<boolean>;
}) {
  const [state, setState] = useState<FeedbackState>("idle");

  async function handleClick() {
    if (state !== "idle") return;
    setState("pending");
    const ok = await onClick();
    setState(ok ? "done" : "idle");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state !== "idle"}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-accent",
        state === "done" && "text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {state === "done" ? doneLabel : label}
    </button>
  );
}

export function PostOverflowMenu({ postId, creatorId }: { postId: string; creatorId: string }) {
  async function sendFeedback(kind: "interested" | "not_interested") {
    const res = await fetch("/api/content-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, kind }),
    });
    return res.ok;
  }

  async function hideCreator() {
    const res = await fetch("/api/hidden-creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId }),
    });
    return res.ok;
  }

  return (
    <OverflowMenu label="Post options">
      <MenuRow icon={ThumbsUp} label="Interested" doneLabel="Thanks!" onClick={() => sendFeedback("interested")} />
      <MenuRow
        icon={ThumbsDown}
        label="Not interested"
        doneLabel="Got it"
        onClick={() => sendFeedback("not_interested")}
      />
      <MenuRow
        icon={EyeOff}
        label="Hide posts from this creator"
        doneLabel="Hidden"
        onClick={hideCreator}
      />
      <ReportDialog targetType="post" targetId={postId} label="Report post" menu />
    </OverflowMenu>
  );
}
