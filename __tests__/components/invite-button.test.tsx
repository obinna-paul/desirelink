import { rest } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InviteButton } from "@/components/profile/invite-button";
import { server } from "@/test/msw/server";

describe("InviteButton", () => {
  it("shows the message composer immediately on open, without any identity-verification gate", async () => {
    server.use(
      rest.get("http://localhost/api/invite/options", (_req, res, ctx) =>
        res(ctx.status(200), ctx.json({ liveStreamId: null })),
      ),
    );

    const user = userEvent.setup();
    render(<InviteButton recipientId="creator-1" recipientDisplayName="Amara" />);

    await user.click(screen.getByRole("button", { name: /invite/i }));

    await waitFor(() => {
      expect(screen.getByText("Just say hi")).toBeInTheDocument();
    });
    expect(screen.queryByText("Verify your identity to send messages.")).not.toBeInTheDocument();
  });
});
