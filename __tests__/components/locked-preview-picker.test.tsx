import { fireEvent, render, screen } from "@testing-library/react";

import { LockedPreviewPicker } from "@/components/creator/locked-preview-picker";

describe("LockedPreviewPicker", () => {
  it("explains the private default and allows a blurred preview", () => {
    const onChange = jest.fn();
    render(<LockedPreviewPicker value="hidden" onChange={onChange} />);

    expect(screen.getByRole("radio", { name: /hide completely/i })).toBeChecked();
    expect(screen.getByText(/hidden is the private default/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /show blurred preview/i }));
    expect(onChange).toHaveBeenCalledWith("blurred");
  });
});
