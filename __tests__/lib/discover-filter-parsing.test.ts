import {
  AVAILABILITY_FILTER_OPTIONS,
  parseDiscoverFilters,
} from "@/lib/discover";
import { parseServiceFilters } from "@/lib/service-listings";

describe("search filter parsing", () => {
  it("accepts only profile details and availability states the app stores", () => {
    const filters = parseDiscoverFilters({
      gender: ["Woman", "Not a stored gender"],
      orientation: ["Bisexual", "Not a stored orientation"],
      bodyType: "Athletic",
      availability: "looking_for_event",
    });

    expect(filters.genders).toEqual(["Woman"]);
    expect(filters.orientations).toEqual(["Bisexual"]);
    expect(filters.availability).toBe("any");
    expect(filters).not.toHaveProperty("bodyTypes");
    expect(AVAILABILITY_FILTER_OPTIONS.map((option) => String(option.value))).not.toContain(
      "looking_for_event",
    );
  });

  it("shows all service providers unless verification is explicitly requested", () => {
    expect(parseServiceFilters({}).verifiedOnly).toBe(false);
    expect(parseServiceFilters({ verified: "true" }).verifiedOnly).toBe(true);
    expect(parseServiceFilters({ verified: "false" }).verifiedOnly).toBe(false);
  });
});
