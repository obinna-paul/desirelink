import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  resolveSpecType,
  scoreSpecTestAnswers,
  specTestQuestionIds,
  type SpecTestAnswers,
} from "@/lib/spec-test";

const QUESTION_IDS = new Set(specTestQuestionIds());
const VALID_OPTIONS = new Set(["A", "B", "C", "D"]);

function isValidAnswers(value: unknown): value is SpecTestAnswers {
  if (!value || typeof value !== "object") return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length !== QUESTION_IDS.size) return false;
  return entries.every(([questionId, option]) => QUESTION_IDS.has(questionId) && VALID_OPTIONS.has(option as string));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!isValidAnswers(body?.answers)) {
    return NextResponse.json(
      { error: `Answer all ${QUESTION_IDS.size} questions to see your result.` },
      { status: 400 },
    );
  }

  // Scored server-side only - a client-submitted result could never be trusted, and the
  // scoring/weighting logic is deliberately not shipped to the browser at all.
  const scores = scoreSpecTestAnswers(body.answers);
  const specType = resolveSpecType(scores);

  const result = await prisma.specTestResult.create({
    data: {
      specType,
      scores,
      answers: body.answers,
    },
    select: { id: true },
  });

  return NextResponse.json({ resultId: result.id }, { status: 201 });
}
