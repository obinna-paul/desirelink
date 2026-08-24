import Link from "next/link";
import {
  Clock,
  Crown,
  Lightbulb,
  MessageCircle,
  MessageSquareText,
  Send,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents, type CreatorAssistantInsights } from "@/lib/creator";

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function InsightSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Lightbulb;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Icon className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyInsight({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function CreatorAssistantPanel({ insights }: { insights: CreatorAssistantInsights }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <InsightSection icon={Crown} title="Top fans by spending">
        {insights.topFans.length === 0 ? (
          <EmptyInsight>Subscriber purchases will appear here after successful payments.</EmptyInsight>
        ) : (
          <ul className="divide-y divide-border/60">
            {insights.topFans.map((fan, index) => (
              <li key={fan.profile.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={fan.profile.avatarUrl} alt={fan.profile.displayName} />
                    <AvatarFallback>{initials(fan.profile.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <Link
                      href={`/profile/${fan.profile.username}`}
                      className="truncate text-sm font-medium hover:text-neon-pink"
                    >
                      {index + 1}. {fan.profile.displayName}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {fan.tiers.length > 0 ? fan.tiers.join(", ") : `@${fan.profile.username}`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatCents(fan.totalSpentCents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fan.transactionCount} {fan.transactionCount === 1 ? "payment" : "payments"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </InsightSection>

      <InsightSection icon={MessageCircle} title="Fans to re-engage">
        {insights.dormantFans.length === 0 ? (
          <EmptyInsight>No active subscribers are past the 30-day quiet mark.</EmptyInsight>
        ) : (
          <ul className="divide-y divide-border/60">
            {insights.dormantFans.map((fan) => (
              <li key={fan.profile.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={fan.profile.avatarUrl} alt={fan.profile.displayName} />
                    <AvatarFallback>{initials(fan.profile.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fan.profile.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Last signal {formatDate(fan.lastInteractionAt)} &middot; {fan.inactiveDays} days ago
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
                  <Link href={`/messages?with=${fan.profile.username}`}>
                    <Send className="h-3.5 w-3.5" aria-hidden="true" /> Reach out
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </InsightSection>

      <InsightSection icon={Clock} title="Suggested post times">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          {insights.suggestedPostTimes.map((suggestion) => (
            <div key={suggestion.label} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-sm font-medium">{suggestion.label}</p>
              <p className="text-lg font-semibold tabular-nums">{suggestion.time}</p>
              <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
            </div>
          ))}
        </div>
      </InsightSection>

      <InsightSection icon={MessageSquareText} title="Quick reply templates">
        <div className="grid grid-cols-1 gap-2">
          {insights.quickReplyTemplates.map((template) => (
            <div key={template.title} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{template.title}</p>
                <Badge variant="secondary">{template.intent}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{template.body}</p>
            </div>
          ))}
        </div>
      </InsightSection>
    </div>
  );
}
