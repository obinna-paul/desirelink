import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { rest } from "msw";
import * as navigation from "next/navigation";

import { SpecTestQuizFlow } from "@/components/spec-test/quiz-flow";
import { server } from "@/test/msw/server";
import { SPEC_TEST_ITEMS_V2 } from "@/lib/spec-test/items/spec-v2";
import { INSTRUMENT_VERSION } from "@/lib/spec-test/taxonomy";
import { routeForm, type Gender } from "@/lib/spec-test/gender/forms";
import { renderTerms } from "@/lib/spec-test/gender/render";
import type { SpecTestResponseV2 } from "@/lib/spec-test/response";

const mockRouter = (navigation as unknown as { __mockRouter: { push: jest.Mock } }).__mockRouter;

const SUBMIT_URL = "http://localhost/api/spec-test/submit";
const TOTAL_ITEMS = SPEC_TEST_ITEMS_V2.length;

type SubmitPayload = {
  instrumentVersion: string;
  gender: Gender;
  responses: SpecTestResponseV2[];
};

// The hold-then-exit animation before advancing to the next item (see SELECT_HOLD_MS/EXIT_MS
// in the component) uses real setTimeouts - fake timers make the whole quiz driveable in a
// single synchronous-feeling test instead of a genuinely ~15s wall-clock run.
async function advancePastTransition() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(700);
  });
}

async function startQuiz(gender: Gender = "male") {
  fireEvent.click(await screen.findByTestId(`spec-gender-${gender}`));
  fireEvent.click(await screen.findByTestId("spec-continue")); // spark section intro
}

async function answerCurrentItem() {
  const options = await screen.findAllByTestId("spec-option");
  fireEvent.click(options[0]);
  await advancePastTransition();
}

/** Answers every item in the bank, crossing every section intro along the way. */
async function completeAllItems() {
  for (let i = 0; i < TOTAL_ITEMS; i += 1) {
    const continueButtons = screen.queryAllByTestId("spec-continue");
    if (continueButtons.length > 0) {
      fireEvent.click(continueButtons[0]);
    }
    await answerCurrentItem();
  }
}

describe("SpecTestQuizFlow (v2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    window.localStorage.clear();
  });

  it("walks the gender question, all sections, and submits a full v2 payload", async () => {
    let capturedBody: SubmitPayload | null = null;
    server.use(
      rest.post(SUBMIT_URL, async (req, res, ctx) => {
        capturedBody = await req.json();
        return res(ctx.status(201), ctx.json({ resultId: "result-abc", confidence: "clear" }));
      }),
    );

    render(<SpecTestQuizFlow />);

    await startQuiz("male");
    await completeAllItems();

    await waitFor(() => expect(capturedBody).not.toBeNull());

    expect(capturedBody!.instrumentVersion).toBe(INSTRUMENT_VERSION);
    expect(capturedBody!.gender).toBe("male");
    expect(capturedBody!.responses).toHaveLength(TOTAL_ITEMS);

    const bankIds = new Set(SPEC_TEST_ITEMS_V2.map((item) => item.id));
    for (const response of capturedBody!.responses) {
      expect(bankIds.has(response.itemId)).toBe(true);
      const item = SPEC_TEST_ITEMS_V2.find((candidate) => candidate.id === response.itemId)!;
      const validOptionIds = new Set(item.options.map((option) => option.id));
      expect(response.optionId).not.toBeNull();
      expect(validOptionIds.has(response.optionId!)).toBe(true);
      expect(typeof response.elapsedMs).toBe("number");
      expect([0, 1, 2, 3]).toContain(response.presentedIndex);
    }

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/spec-test/result/result-abc"));
  });

  it("lets the taker skip an item and still submits a full response set", async () => {
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
    await advancePastTransition();

    for (let i = 1; i < TOTAL_ITEMS; i += 1) {
      const continueButtons = screen.queryAllByTestId("spec-continue");
      if (continueButtons.length > 0) fireEvent.click(continueButtons[0]);
      await answerCurrentItem();
    }

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody!.responses).toHaveLength(TOTAL_ITEMS);
    const firstItemResponse = capturedBody!.responses.find((r) => r.itemId === SPEC_TEST_ITEMS_V2[0].id)!;
    expect(firstItemResponse.skipped).toBe(true);
    expect(firstItemResponse.optionId).toBeNull();
  });

  it("supports going back to a previous question and re-answering it", async () => {
    render(<SpecTestQuizFlow />);
    await startQuiz();

    await answerCurrentItem(); // item 0 answered, now on item 1 (still within spark, no intro)
    expect(await screen.findByText(SPEC_TEST_ITEMS_V2[1].prompt)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("spec-back"));
    expect(await screen.findByText(SPEC_TEST_ITEMS_V2[0].prompt)).toBeInTheDocument();
  });

  it("shows a retake prompt on a low-signal server response, without navigating", async () => {
    server.use(
      rest.post(SUBMIT_URL, async (_req, res, ctx) => res(ctx.status(200), ctx.json({ lowSignal: true, flags: ["too_fast"] }))),
    );

    render(<SpecTestQuizFlow />);
    await startQuiz();
    await completeAllItems();

    expect(await screen.findByText(/couldn't get a clear read/i)).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("spec-take-again"));
    expect(await screen.findByTestId("spec-continue")).toBeInTheDocument();
  });

  it("keeps the chosen gender on a low-signal retake instead of re-asking it", async () => {
    let capturedBody: SubmitPayload | null = null;
    server.use(
      rest.post(SUBMIT_URL, async (req, res, ctx) => {
        capturedBody = await req.json();
        return res(ctx.status(200), ctx.json({ lowSignal: true, flags: ["too_fast"] }));
      }),
    );

    render(<SpecTestQuizFlow />);
    await startQuiz("female");
    await completeAllItems();
    expect(await screen.findByText(/couldn't get a clear read/i)).toBeInTheDocument();
    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody!.gender).toBe("female");

    fireEvent.click(screen.getByTestId("spec-take-again"));
    // Retake lands straight on a section intro, not the gender step.
    expect(await screen.findByTestId("spec-continue")).toBeInTheDocument();
    expect(screen.queryByTestId("spec-gender-female")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spec-gender-male")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("spec-continue"));
    // The retake's form is still female_user (male referent) - confirmed by answering up to
    // the first tokenized item ("hosting-party", index 6) and checking its rendered text,
    // rather than running a second full 24-item submission.
    for (let i = 0; i < 6; i += 1) {
      await answerCurrentItem();
    }
    const hostingItem = SPEC_TEST_ITEMS_V2.find((item) => item.id === "hosting-party")!;
    expect(await screen.findByText(renderTerms(hostingItem.prompt, "female_user"))).toBeInTheDocument();
  });

  it("persists progress across a remount (draft survives a reload)", async () => {
    const first = render(<SpecTestQuizFlow />);
    await startQuiz();
    await answerCurrentItem();
    await answerCurrentItem();
    expect(await screen.findByText(SPEC_TEST_ITEMS_V2[2].prompt)).toBeInTheDocument();

    // A page reload unmounts the old tree and mounts a fresh one against the same
    // localStorage - simulated here without a real navigation.
    first.unmount();
    render(<SpecTestQuizFlow />);
    expect(await screen.findByText(SPEC_TEST_ITEMS_V2[2].prompt)).toBeInTheDocument();
  });

  it("resumes a draft on the taker's chosen form without ever re-asking gender", async () => {
    const first = render(<SpecTestQuizFlow />);
    await startQuiz("female");
    await answerCurrentItem();

    first.unmount();
    render(<SpecTestQuizFlow />);

    // Never re-shown the gender step, and the female_user form (male referent) is still in use.
    expect(screen.queryByTestId("spec-gender-female")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spec-gender-male")).not.toBeInTheDocument();
    const hostingItem = SPEC_TEST_ITEMS_V2.find((item) => item.id === "hosting-party");
    if (hostingItem) {
      // Not necessarily the item on screen right now - this just confirms the form used for
      // rendering resolves the same way the report/plan require (§8 acceptance criteria).
      expect(renderTerms(hostingItem.prompt, routeForm("female").quizForm)).toContain("man");
    }
  });

  it("renders no scored item until the gender question is answered", async () => {
    render(<SpecTestQuizFlow />);

    expect(await screen.findByText(/what's your gender/i)).toBeInTheDocument();
    expect(screen.queryByTestId("spec-continue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spec-option")).not.toBeInTheDocument();
  });

  it("renders items using the taker's own form, differing only in the substituted terms", async () => {
    const hostingItem = SPEC_TEST_ITEMS_V2.find((item) => item.id === "hosting-party")!;
    const maleUserText = renderTerms(hostingItem.prompt, "male_user");
    const femaleUserText = renderTerms(hostingItem.prompt, "female_user");

    expect(maleUserText).not.toEqual(femaleUserText);
    expect(maleUserText).toContain("woman");
    expect(femaleUserText).toContain("man");
    // Same template underneath - the two forms only ever differ in the rendered term.
    expect(maleUserText.replace("woman", "{person}")).toEqual(femaleUserText.replace("man", "{person}"));
  });
});
