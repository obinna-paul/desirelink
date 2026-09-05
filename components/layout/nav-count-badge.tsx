export function NavCountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ${className ?? ""}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
