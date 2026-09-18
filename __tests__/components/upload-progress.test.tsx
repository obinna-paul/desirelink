import { render, screen } from "@testing-library/react";

import { UploadProgress } from "@/components/ui/upload-progress";

describe("UploadProgress", () => {
  it("makes provider confirmation explicit after all bytes are sent", () => {
    render(
      <UploadProgress
        progress={100}
        label="Confirming your video..."
        hint="Your video has been sent."
        fileName="premium.mp4"
        phase="confirming"
      />,
    );

    expect(screen.getByText("Confirming your video...")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toHaveClass("font-semibold");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("uses an honest indeterminate state before measurable progress exists", () => {
    render(
      <UploadProgress
        progress={null}
        label="Preparing video..."
        fileName="clip.mp4"
        phase="preparing"
      />,
    );

    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});
