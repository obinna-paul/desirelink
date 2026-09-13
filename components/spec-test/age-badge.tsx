/** "18+" header pill shown across the whole Spec Test flow (intro, quiz, result) -
 *  factored out so the three pages stay visually identical rather than each hand-rolling
 *  the same span. */
export function AgeBadge() {
  return (
    <span className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">
      18+
    </span>
  );
}
