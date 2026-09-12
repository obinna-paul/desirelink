import { rest } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InviteButton } from "@/components/profile/invite-button";
import { server } from "@/test/msw/server";

describe("InviteButton", () => {
  it("shows the identity-verification gate immediately on open when the viewer has none on file", async () => {
    const user = userEvent.setup();
    render(
      <InviteButton
        recipientId="creator-1"
        recipientDisplayName="Amara"
        viewerHasIdentityOnFile={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /invite/i }));

    expect(
      await screen.findByText("Verify your identity to send messages."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Just say hi")).not.toBeInTheDocument();
  });

  it("defaults to the identity gate when viewerHasIdentityOnFile isn't passed at all", async () => {
    const user = userEvent.setup();
    render(<InviteButton recipientId="creator-1" recipientDisplayName="Amara" />);

    await user.click(screen.getByRole("button", { name: /invite/i }));

    expect(
      await screen.findByText("Verify your identity to send messages."),
    ).toBeInTheDocument();
  });

  it("shows the normal message composer when the viewer already has identity on file", async () => {
    server.use(
      rest.get("http://localhost/api/invite/options", (_req, res, ctx) =>
        res(ctx.status(200), ctx.json({ liveStreamId: null })),
      ),
    );

    const user = userEvent.setup();
    render(
      <InviteButton
        recipientId="creator-1"
        recipientDisplayName="Amara"
        viewerHasIdentityOnFile={true}
      />,
    );

    await user.click(screen.getByRole("button", { name: /invite/i }));

    await waitFor(() => {
      expect(screen.getByText("Just say hi")).toBeInTheDocument();
    });
    expect(screen.queryByText("Verify your identity to send messages.")).not.toBeInTheDocument();
  });
});
