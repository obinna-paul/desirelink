import { fireEvent, render, screen } from "@testing-library/react";

import { TierPicker } from "@/components/creator/tier-picker";

const tiers = [
  {
    id: "tier-entry",
    name: "Inner Circle",
    priceCents: 500000,
    compareAtPriceCents: null,
  },
  {
    id: "tier-vip",
    name: "VIP Access",
    priceCents: 900000,
    compareAtPriceCents: 1200000,
  },
];

describe("TierPicker", () => {
  it("uses an in-app dialog instead of a native select", () => {
    const onChange = jest.fn();
    const { container } = render(
      <TierPicker tiers={tiers} value={null} onChange={onChange} />,
    );

    expect(container.querySelector("select")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: /which tier unlocks this post/i }));
    expect(screen.getByRole("dialog", { name: /choose an access tier/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /vip access/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    fireEvent.click(screen.getByRole("option", { name: /vip access/i }));
    expect(onChange).toHaveBeenCalledWith("tier-vip");
    expect(screen.queryByRole("dialog", { name: /choose an access tier/i })).not.toBeInTheDocument();
  });

  it("shows the selected tier in the trigger and marks it in the picker", () => {
    render(<TierPicker tiers={tiers} value="tier-entry" onChange={jest.fn()} />);

    expect(
      screen.getByRole("combobox", { name: /which tier unlocks this post/i }),
    ).toHaveTextContent("Inner Circle");
    fireEvent.click(
      screen.getByRole("combobox", { name: /which tier unlocks this post/i }),
    );
    expect(screen.getByRole("option", { name: /inner circle/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
