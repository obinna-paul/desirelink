"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SPEC_TEST_QUESTIONS, type SpecTestOptionKey } from "@/lib/spec-test-questions";
import { cn } from "@/lib/utils";

type Step = "age-gate" | "question" | "submitting";

/**
 * Anonymous, single-page quiz wizard - age gate, then one scenario question at a time
 * with auto-advance on answer, then a submit to the server (which does the actual
 * scoring - see lib/spec-test.ts) and a redirect to the shareable result page.
 */
export function SpecTestQuizFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("age-gate");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SpecTestOptionKey>>({});
  const [error, setError] = useState<string | null>(null);

  const totalQuestions = SPEC_TEST_QUESTIONS.length;
  const currentQuestion = SPEC_TEST_QUESTIONS[questionIndex];

  async function submitAnswers(finalAnswers: Record<string, SpecTestOptionKey>) {
    setStep("submitting");
    setError(null);
    try {
      const res = await fetch("/api/spec-test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Something went wrong scoring your answers. Please try again.");
        setStep("question");
        return;
      }
      router.push(`/spec-test/result/${body.resultId}`);
    } catch {
      setError("Something went wrong scoring your answers. Please try again.");
      setStep("question");
    }
  }

  function selectOption(option: SpecTestOptionKey) {
    const nextAnswers = { ...answers, [currentQuestion.id]: option };
    setAnswers(nextAnswers);

    if (questionIndex + 1 < totalQuestions) {
      setQuestionIndex((index) => index + 1);
    } else {
      void submitAnswers(nextAnswers);
    }
  }

  if (step === "age-gate") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <Sparkles className="h-10 w-10 text-primary" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Before we start</h1>
          <p className="text-sm text-muted-foreground">
            The Spec Test asks about attraction and dating, so it&apos;s only for adults 18 and over.
            Your answers are used only to generate your result - not shared publicly or used for
            advertising unless you say so.
          </p>
        </div>
        <Button size="lg" onClick={() => setStep("question")} className="w-full max-w-xs">
          I&apos;m 18 or older - Start
        </Button>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="font-heading text-lg font-semibold">Reading your answers...</p>
        <p className="text-sm text-muted-foreground">Calculating your spec.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <ProgressRing progress={(questionIndex / totalQuestions) * 100} size={40} className="shrink-0 text-primary" />
        <p className="text-xs font-medium text-muted-foreground">
          Question {questionIndex + 1} of {totalQuestions}
        </p>
      </div>

      <h1 className="font-heading text-xl font-bold sm:text-2xl">{currentQuestion.prompt}</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-3">
        {(Object.entries(currentQuestion.options) as [SpecTestOptionKey, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => selectOption(key)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left text-sm font-medium",
              "transition-colors hover:border-primary/60 hover:bg-accent-tint/70",
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-bold text-primary">
              {key}
            </span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
