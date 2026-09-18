import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  BestWorstQuestion,
  type BestWorstSelection,
} from "@/components/spec-test/pilot/best-worst-question";
import { V3_PILOT_BEST_WORST_ITEMS } from "@/lib/spec-test/items/spec-v3-pilot";

const item = V3_PILOT_BEST_WORST_ITEMS[0];

function ControlledQuestion({ onChange }: { onChange?: (value: BestWorstSelection) => void }) {
  const [value, setValue] = useState<BestWorstSelection>({ bestOptionId: null, worstOptionId: null });
  return (
    <BestWorstQuestion
      item={item}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("BestWorstQuestion", () => {
  it("explains both judgments and exposes native toggle state", () => {
    render(<ControlledQuestion />);
    expect(screen.getByText(item.prompt)).toBeInTheDocument();
    expect(screen.getByText(/both answers matter/i)).toBeInTheDocument();

    const most = screen.getByTestId(`v3-most-${item.options[0].id}`);
    const least = screen.getByTestId(`v3-least-${item.options[1].id}`);
    expect(most).toHaveAttribute("aria-pressed", "false");
    expect(least).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(most);
    fireEvent.click(least);
    expect(most).toHaveAttribute("aria-pressed", "true");
    expect(least).toHaveAttribute("aria-pressed", "true");
  });

  it("moves an option between poles instead of allowing the same option twice", () => {
    const changes: BestWorstSelection[] = [];
    render(<ControlledQuestion onChange={(value) => changes.push(value)} />);
    const most = screen.getByTestId(`v3-most-${item.options[0].id}`);
    const leastSameOption = screen.getByTestId(`v3-least-${item.options[0].id}`);

    fireEvent.click(most);
    fireEvent.click(leastSameOption);

    expect(changes.at(-1)).toEqual({ bestOptionId: null, worstOptionId: item.options[0].id });
    expect(most).toHaveAttribute("aria-pressed", "false");
    expect(leastSameOption).toHaveAttribute("aria-pressed", "true");
  });

  it("honors randomized presentation order without changing option identity", () => {
    render(
      <BestWorstQuestion
        item={item}
        value={{ bestOptionId: null, worstOptionId: null }}
        onChange={() => undefined}
        optionOrder={[3, 2, 1, 0]}
      />,
    );
    const labels = screen.getAllByRole("group").slice(1).map((group) => group.getAttribute("aria-label"));
    expect(labels[0]).toContain(item.options[3].label);
  });
});
