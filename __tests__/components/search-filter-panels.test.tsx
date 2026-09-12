import { fireEvent, render, screen } from "@testing-library/react";

import { DiscoverFiltersPanel } from "@/components/discover/discover-filters";
import { ServiceFiltersPanel } from "@/components/services/service-filters";

const discoverFilters = {
  query: "",
  genders: [],
  orientations: [],
  lastActive: "any" as const,
  verification: "any" as const,
  radiusKm: null,
  availability: "any" as const,
  sort: "recommended" as const,
};

const serviceFilters = {
  categories: [],
  minPriceCents: null,
  maxPriceCents: null,
  city: "",
  radiusKm: null,
  verifiedOnly: false,
  sort: "newest" as const,
};

describe("search filter panels", () => {
  it("keeps Discover filters closed until requested and uses an in-app choice menu", () => {
    const { container } = render(<DiscoverFiltersPanel initialFilters={discoverFilters} />);

    expect(screen.queryByText("Location and activity")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByText("Location and activity")).toBeInTheDocument();
    expect(screen.queryByText("Body type")).not.toBeInTheDocument();
    expect(container.querySelector("select")).toBeNull();

    fireEvent.click(screen.getByRole("combobox", { name: "Distance" }));
    expect(screen.getByRole("listbox", { name: "Distance" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Any distance" })).toBeInTheDocument();
  });

  it("resets Distance to Any distance instead of re-applying the default radius", () => {
    render(<DiscoverFiltersPanel initialFilters={{ ...discoverFilters, radiusKm: 50 }} />);

    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    expect(screen.getByRole("combobox", { name: "Distance" })).toHaveTextContent("Within 50 km");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("combobox", { name: "Distance" })).toHaveTextContent("Any distance");
  });

  it("keeps Service filters closed and does not filter verification by default", () => {
    const { container } = render(<ServiceFiltersPanel initialFilters={serviceFilters} />);

    expect(screen.queryByText("Price and location")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByText("Price and location")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Verified profiles only" })).not.toBeChecked();
    expect(container.querySelector("select")).toBeNull();
  });
});
