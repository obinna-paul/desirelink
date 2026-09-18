import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { rest } from "msw";

import { SpecTestPilotFlow } from "@/components/spec-test/pilot/pilot-flow";
import { V3_PILOT_INSTRUMENT_VERSION } from "@/lib/spec-test/items/spec-v3-pilot";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import { server } from "@/test/msw/server";

const SUBMIT_URL = "http://localhost/api/spec-test/pilot/submit";

describe("SpecTestPilotFlow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    server.use(
      rest.post("http://localhost/api/spec-test/pilot/progress", (_request, response, context) =>
        response(context.status(200), context.json({ recorded: true })),
      ),
    );
  });
  afterEach(() => window.localStorage.clear());

  it("requires explicit consent and keeps validation next to the unanswered question", () => {
    render(<SpecTestPilotFlow />);
    expect(screen.getByTestId("v3-pilot-consent")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("v3-pilot-start"));
    fireEvent.click(screen.getByTestId("v3-pilot-next"));
    expect(screen.getByRole("alert")).toHaveTextContent(/choose one Most and one Least/i);
  });

  it("persists a completed answer as a resumable versioned draft", () => {
    render(<SpecTestPilotFlow />);
    fireEvent.click(screen.getByTestId("v3-pilot-start"));
    const most = screen.getAllByRole("button", { name: /^Most:/i })[0];
    const least = screen.getAllByRole("button", { name: /^Least:/i })[1];
    fireEvent.click(most);
    fireEvent.click(least);
    fireEvent.click(screen.getByTestId("v3-pilot-next"));

    const stored = JSON.parse(window.localStorage.getItem("spec-test-v3-pilot-draft") ?? "null") as {
      instrumentVersion: string;
      responses: Record<string, SpecTestResponseV3>;
    };
    expect(stored.instrumentVersion).toBe(V3_PILOT_INSTRUMENT_VERSION);
    expect(Object.keys(stored.responses)).toHaveLength(1);
  });

  it("completes all three interaction types and submits stable response ids", async () => {
    let captured: { attemptId: string; instrumentVersion: string; researchConsent: boolean; responses: SpecTestResponseV3[] } | null = null;
    server.use(
      rest.post(SUBMIT_URL, async (request, response, context) => {
        captured = await request.json();
        return response(context.status(201), context.json({ submissionId: "pilot-1" }));
      }),
    );

    render(<SpecTestPilotFlow />);
    fireEvent.click(screen.getByTestId("v3-pilot-start"));

    for (let index = 0; index < 28; index += 1) {
      const radios = screen.queryAllByRole("radio");
      if (index < 16) {
        fireEvent.click(screen.getAllByRole("button", { name: /^Most:/i })[0]);
        fireEvent.click(screen.getAllByRole("button", { name: /^Least:/i })[1]);
      } else if (index < 24) {
        fireEvent.click(radios[3]);
      } else {
        fireEvent.click(radios[0]);
      }
      fireEvent.click(screen.getByTestId("v3-pilot-next"));
    }

    expect(await screen.findByTestId("v3-pilot-complete")).toBeInTheDocument();
    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured!.instrumentVersion).toBe(V3_PILOT_INSTRUMENT_VERSION);
    expect(captured!.attemptId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(captured!.researchConsent).toBe(true);
    expect(captured!.responses).toHaveLength(28);
    expect(window.localStorage.getItem("spec-test-v3-pilot-draft")).toBeNull();
  });
});
