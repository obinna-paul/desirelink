import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { rest } from "msw";

import { ChatWindow } from "@/components/messages/chat-window";
import { server } from "@/test/msw/server";
import type { ConversationParticipant } from "@/lib/message-types";

// jsdom doesn't implement Element.scrollTo - the component's own scroll-to-bottom logic
// calls it on mount/update, unrelated to what this file is testing.
beforeAll(() => {
  HTMLElement.prototype.scrollTo = jest.fn();
});

function setUserAgent(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

const counterpart: ConversationParticipant = {
  id: "counterpart-1",
  username: "jane",
  displayName: "Jane Doe",
  avatarUrl: "",
  profileType: "EXPLORER",
  isVerified: false,
  isVerifiedCreator: false,
  isVerifiedServiceProvider: false,
  verificationPending: false,
};

function mockPresence() {
  server.use(
    rest.get("http://localhost/api/messages/presence", (_req, res, ctx) =>
      res(ctx.json({ visible: false, state: "hidden", lastActiveAt: null })),
    ),
  );
}

describe("ChatWindow - Enter key sends only from a physical keyboard", () => {
  beforeEach(() => {
    mockPresence();
  });

  it("sends the message on a bare Enter when it's a desktop/physical keyboard", async () => {
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120");
    let sentBody: { content?: string } | null = null;
    server.use(
      rest.post("http://localhost/api/messages/send", async (req, res, ctx) => {
        sentBody = await req.json();
        return res(
          ctx.json({
            message: {
              id: "msg-1",
              content: sentBody?.content ?? "",
              createdAt: new Date().toISOString(),
              readAt: null,
              senderId: "viewer-1",
              recipientId: "counterpart-1",
              replyToId: null,
              replyTo: null,
              mediaUrl: null,
              mediaType: null,
              mediaMimeType: null,
              mediaWidth: null,
              mediaHeight: null,
              mediaDurationSeconds: null,
            },
          }),
        );
      }),
    );

    render(<ChatWindow viewerProfileId="viewer-1" counterpart={counterpart} initialMessages={[]} />);

    const textarea = await screen.findByPlaceholderText("Message...");
    fireEvent.change(textarea, { target: { value: "Hello there" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => expect(sentBody).not.toBeNull());
    expect(sentBody).toMatchObject({ content: "Hello there" });
  });

  it("does not send on a bare Enter from a touch device - it's the on-screen keyboard's own return key", async () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile", 5);
    let sendCalled = false;
    server.use(
      rest.post("http://localhost/api/messages/send", (_req, res, ctx) => {
        sendCalled = true;
        return res(ctx.status(500));
      }),
    );

    render(<ChatWindow viewerProfileId="viewer-1" counterpart={counterpart} initialMessages={[]} />);

    const textarea = await screen.findByPlaceholderText("Message...");
    fireEvent.change(textarea, { target: { value: "Hello there" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    // Give any (wrongly) fired send request a moment to land before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sendCalled).toBe(false);
    // The textarea keeps its content - the handler returned early rather than clearing it
    // the way a successful send would (see sendMessagePayload's setContent("")).
    expect(textarea).toHaveValue("Hello there");
  });

  it("never sends on Shift+Enter, on either desktop or a touch device", async () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/140 Mobile", 5);
    let sendCalled = false;
    server.use(
      rest.post("http://localhost/api/messages/send", (_req, res, ctx) => {
        sendCalled = true;
        return res(ctx.status(500));
      }),
    );

    render(<ChatWindow viewerProfileId="viewer-1" counterpart={counterpart} initialMessages={[]} />);

    const textarea = await screen.findByPlaceholderText("Message...");
    fireEvent.change(textarea, { target: { value: "Hello there" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sendCalled).toBe(false);
  });
});
