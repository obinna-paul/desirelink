import { fireEvent, render, screen } from "@testing-library/react";

import { IntensityQuestion } from "@/components/spec-test/pilot/intensity-question";
import { SingleChoiceQuestion } from "@/components/spec-test/pilot/single-choice-question";
import {
  V3_PILOT_INTENSITY_ITEMS,
  V3_PILOT_UNCERTAINTY_ITEMS,
} from "@/lib/spec-test/items/spec-v3-pilot";

describe("v3 pilot question controls", () => {
  it("uses a native seven-point radio group with visible endpoint labels", () => {
    const onChange = jest.fn();
    const item = V3_PILOT_INTENSITY_ITEMS[0];
    render(<IntensityQuestion item={item} value={null} onChange={onChange} />);
    expect(screen.getByText(item.lowLabel)).toBeInTheDocument();
    expect(screen.getByText(item.highLabel)).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(7);
    fireEvent.click(radios[6]);
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("keeps a randomized single-choice order while submitting stable option ids", () => {
    const onChange = jest.fn();
    const item = V3_PILOT_UNCERTAINTY_ITEMS[0];
    render(
      <SingleChoiceQuestion
        item={item}
        value={null}
        onChange={onChange}
        optionOrder={[3, 2, 1, 0]}
      />,
    );
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]);
    expect(onChange).toHaveBeenCalledWith(item.options[3].id);
  });
});
