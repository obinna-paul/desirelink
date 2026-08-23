const placeholderPeople = [
  { name: "Ava", status: "Available tonight", distance: "1.2 mi" },
  { name: "Jordan & Sam", status: "Open to meeting", distance: "2.8 mi" },
  { name: "Riley", status: "Available tonight", distance: "0.6 mi" },
];

export function RightRail() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/60 px-4 py-6 xl:flex">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_8px_hsl(var(--neon-cyan))]" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Available Tonight
        </h2>
      </div>

      <ul className="flex flex-col gap-3">
        {placeholderPeople.map((person) => (
          <li
            key={person.name}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5"
          >
            <div>
              <p className="text-sm font-medium">{person.name}</p>
              <p className="text-xs text-muted-foreground">{person.status}</p>
            </div>
            <span className="text-xs text-neon-cyan">{person.distance}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
