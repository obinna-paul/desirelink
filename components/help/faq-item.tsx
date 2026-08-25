export function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border/60 bg-card px-4 py-1 open:pb-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {question}
        <span
          aria-hidden="true"
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground [&_a]:text-neon-pink [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </details>
  );
}
