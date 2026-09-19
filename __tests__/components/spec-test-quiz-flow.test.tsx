import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { rest } from "msw";
import * as navigation from "next/navigation";

import { SpecTestQuizFlow } from "@/components/spec-test/quiz-flow";
import { routeForm, type Gender } from "@/lib/spec-test/gender/forms";
import { renderTerms } from "@/lib/spec-test/gender/render";
import { SPEC_TEST_ITEMS_V3, V3_INSTRUMENT_VERSION } from "@/lib/spec-test/items/spec-v3";
import type { SpecTestResponseV3 } from "@/lib/spec-test/response";
import { server } from "@/test/msw/server";

const mockRouter = (navigation as unknown as { __mockRouter: { push: jest.Mock } }).__mockRouter;
const SUBMIT_URL = "http://localhost/api/spec-test/submit";

type SubmitPayload = {
  instrumentVersion: string;
  gender: Gender;
  responses: SpecTestResponseV3[];
};

async function startQuiz(gender: Gender = "male") {
  fireEvent.click(await screen.findByTestId(`spec-gender-${gender}`));
  fireEvent.click(await screen.findByTestId("spec-continue"));
}

async function answerCurrentItem(index: number) {
  const item = SPEC_TEST_ITEMS_V3[index];
  await screen.findByText(`Question ${index + 1} of ${SPEC_TEST_ITEMS_V3.length}`);

  if (item.kind === "best_worst") {
    fireEvent.click(screen.getAllByText("My type")[0]);
    fireEvent.click(screen.getAllByText("Not really")[1]);
  } else if (item.kind === "intensity") {
    fireEvent.click(screen.getByRole("radio", { name: "5" }));
  } else {
    fireEvent.click(screen.getAllByRole("radio")[0]);
  }

  fireEvent.click(screen.getByTestId("spec-next"));
}

async function completeQuiz() {
  for (let index = 0; index < SPEC_TEST_ITEMS_V3.length; index += 1) {
    const intro = screen.queryByTestId("spec-continue");
    if (intro) fireEvent.click(intro);
    await answerCurrentItem(index);
  }
}

describe("SpecTestQuizFlow (official v3)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRouter.push.mockClear();
  });

  afterEach(() => window.localStorage.clear());

  it("asks gender before showing any scored item", async () => {
    render(<SpecTestQuizFlow />);

    expect(await screen.findByText(/what’s your gender/i)).toBeInTheDocument();
    expect(screen.queryByTestId("spec-question")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spec-continue")).not.toBeInTheDocument();
  });

  it("animates forward and backward question changes while locking repeated taps", async () => {
    const originalMatchMedia = window.matchMedia;
    jest.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    try {
      render(<SpecTestQuizFlow />);
      await startQuiz("male");
      expect(screen.getByTestId("spec-question-motion")).toHaveClass("motion-safe:animate-spec-question-enter-forward");

      fireEvent.click(screen.getAllByText("My type")[0]);
      fireEvent.click(screen.getAllByText("Not really")[1]);
      fireEvent.click(screen.getByTestId("spec-next"));

      const leaving = screen.getByTestId("spec-question-motion");
      expect(leaving).toHaveAttribute("data-motion-phase", "exiting");
      expect(leaving).toHaveClass("motion-safe:animate-spec-question-exit-forward");
      expect(screen.getByTestId("spec-next")).toBeDisabled();

      act(() => jest.advanceTimersByTime(300));
      expect(screen.getByText("Question 2 of 28")).toBeInTheDocument();
      expect(screen.getByTestId("spec-question-motion")).toHaveClass("motion-safe:animate-spec-question-enter-forward");

      fireEvent.click(screen.getByTestId("spec-back"));
      expect(screen.getByTestId("spec-question-motion")).toHaveClass("motion-safe:animate-spec-question-exit-backward");
      act(() => jest.advanceTimersByTime(300));
      expect(screen.getByText("Question 1 of 28")).toBeInTheDocument();
      expect(screen.getByTestId("spec-question-motion")).toHaveClass("motion-safe:animate-spec-question-enter-backward");
    } finally {
      jest.useRealTimers();
      Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
    }
  });

  it("renders a woman for a male taker and a man for a female taker", async () => {
    const firstItem = SPEC_TEST_ITEMS_V3[0];
    if (firstItem.kind !== "best_worst") throw new Error("Expected the official test to begin with a best-worst item.");
    const male = render(<SpecTestQuizFlow />);
    await startQuiz("male");
    expect(await screen.findByText(renderTerms(firstItem.options[0].label, routeForm("male").quizForm))).toHaveTextContent("woman");

    male.unmount();
    window.localStorage.clear();
    render(<SpecTestQuizFlow />);
    await startQuiz("female");
    expect(await screen.findByText(renderTerms(firstItem.options[0].label, routeForm("female").quizForm))).toHaveTextContent("man");
  });

  it("submits all 28 questions using the official version and opens the detailed result", async () => {
    let capturedBody: SubmitPayload | null = null;
    server.use(
      rest.post(SUBMIT_URL, async (req, res, ctx) => {
        capturedBody = await req.json();
        return res(ctx.status(201), ctx.json({ resultId: "result-v3", confidence: "clear" }));
      }),
    );

    render(<SpecTestQuizFlow />);
    await startQuiz("male");
    await completeQuiz();

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody!.instrumentVersion).toBe(V3_INSTRUMENT_VERSION);
    expect(capturedBody!.gender).toBe("male");
    expect(capturedBody!.responses).toHaveLength(28);
    expect(capturedBody!.responses.map((response) => response.itemId)).toEqual(
      SPEC_TEST_ITEMS_V3.map((item) => item.id),
    );
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/spec-test/result/result-v3"));
  });

  it("supports skips and still includes every item in the payload", async () => {
    let capturedBody: SubmitPayload | null = null;
    server.use(
      rest.post(SUBMIT_URL, async (req, res, ctx) => {
        capturedBody = await req.json();
        return res(ctx.status(201), ctx.json({ resultId: "result-skip", confidence: "blend" }));
      }),
    );

    render(<SpecTestQuizFlow />);
    await startQuiz();
    fireEvent.click(screen.getByTestId("spec-skip"));
    for (let index = 1; index < SPEC_TEST_ITEMS_V3.length; index += 1) {
      const intro = screen.queryByTestId("spec-continue");
      if (intro) fireEvent.click(intro);
      await answerCurrentItem(index);
    }

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody!.responses).toHaveLength(28);
    expect(capturedBody!.responses[0]).toMatchObject({ itemId: SPEC_TEST_ITEMS_V3[0].id, skipped: true });
  });

  it("preserves gender and progress across a remount", async () => {
    const first = render(<SpecTestQuizFlow />);
    await startQuiz("female");
    await answerCurrentItem(0);
    await screen.findByText("Question 2 of 28");

    first.unmount();
    render(<SpecTestQuizFlow />);

    expect(screen.queryByTestId("spec-gender-female")).not.toBeInTheDocument();
    expect(await screen.findByText("Question 2 of 28")).toBeInTheDocument();
    expect(screen.getByText(renderTerms(SPEC_TEST_ITEMS_V3[1].prompt, "female_user"))).toBeInTheDocument();
  });

  it("keeps gender when the server asks for an honest retake", async () => {
    server.use(
      rest.post(SUBMIT_URL, async (_req, res, ctx) =>
        res(ctx.status(200), ctx.json({ lowSignal: true, flags: ["too_fast"] })),
      ),
    );

    render(<SpecTestQuizFlow />);
    await startQuiz("female");
    await completeQuiz();

    expect(await screen.findByText(/one more honest go/i)).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("spec-take-again"));
    expect(await screen.findByTestId("spec-continue")).toBeInTheDocument();
    expect(screen.queryByTestId("spec-gender-female")).not.toBeInTheDocument();
  });

  it("redirects to a protected recent result when the cooldown endpoint returns its id", async () => {
    server.use(
      rest.post(SUBMIT_URL, async (_req, res, ctx) =>
        res(ctx.status(429), ctx.json({ error: "Come back later.", resultId: "recent-v3-result" })),
      ),
    );

    render(<SpecTestQuizFlow />);
    await startQuiz();
    await completeQuiz();

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/spec-test/result/recent-v3-result"));
  });
});
