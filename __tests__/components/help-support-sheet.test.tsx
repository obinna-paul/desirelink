import { fireEvent, render, screen } from "@testing-library/react";

import { HelpSupportSheet } from "@/components/help/help-support-sheet";

describe("HelpSupportSheet", () => {
  it("portals the mobile sheet above app chrome and keeps its submit action available", () => {
    const { container } = render(
      <div data-testid="menu-stacking-context">
        <HelpSupportSheet defaultEmail="member@example.com" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /help & support/i }));

    const dialog = screen.getByRole("dialog", { name: /contact support/i });
    const submit = screen.getByRole("button", { name: /send message/i });

    expect(container).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
    expect(dialog.parentElement).toHaveClass("z-[70]");
    expect(dialog).toHaveClass("max-h-[calc(100dvh-0.75rem)]");
    expect(submit).toHaveAttribute("form", "help-support-form");
    expect(submit).toHaveClass("min-h-11");
    expect(document.getElementById("help-support-form")).toBeInTheDocument();
  });
});
