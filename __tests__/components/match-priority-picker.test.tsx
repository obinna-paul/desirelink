import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MatchPriorityPicker } from "@/components/spec-test/match-priority-picker";

describe("MatchPriorityPicker", () => {
  afterEach(() => jest.restoreAllMocks());

  it("saves a new priority and announces that recommendations were tuned", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response);
    render(<MatchPriorityPicker initialPriority="BALANCED" />);

    expect(screen.getByRole("radio", { name: /Show me both/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Good chemistry/ }));

    await waitFor(() => expect(screen.getByText("Your recommendations are tuned.")).toBeInTheDocument());
    expect(screen.getByRole("radio", { name: /Good chemistry/ })).toHaveAttribute("aria-checked", "true");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile/match-priority",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ priority: "SPARK" }) }),
    );
  });

  it("restores the previous selection when saving fails", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false } as Response);
    render(<MatchPriorityPicker initialPriority="PARTNERSHIP" />);

    fireEvent.click(screen.getByRole("radio", { name: /Good chemistry/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Please try again"));
    expect(screen.getByRole("radio", { name: /Something real/ })).toHaveAttribute("aria-checked", "true");
  });
});
