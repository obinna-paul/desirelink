export const DISCOVER_SECTIONS = [
  { value: "people", label: "People" },
  { value: "events", label: "Events" },
  { value: "services", label: "Services" },
] as const;

export type DiscoverSectionValue = (typeof DISCOVER_SECTIONS)[number]["value"];

export const DEFAULT_DISCOVER_SECTION: DiscoverSectionValue = "people";

export function isDiscoverSectionValue(value: string | undefined): value is DiscoverSectionValue {
  return DISCOVER_SECTIONS.some((section) => section.value === value);
}
