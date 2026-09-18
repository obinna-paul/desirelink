import { render, screen } from "@testing-library/react";

import { UploadProgress } from "@/components/ui/upload-progress";

describe("UploadProgress", () => {
  it("keeps final upload confirmation generic for users", () => {
    render(
      <UploadProgress
        progress={100}
        label="Upload complete"
        hint="Finishing up..."
        fileName="premium.mp4"
        phase="confirming"
      />,
    );

    expect(screen.getByText("Upload complete")).toBeInTheDocument();
    expect(screen.getByText("Finishing up...")).toBeInTheDocument();
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
