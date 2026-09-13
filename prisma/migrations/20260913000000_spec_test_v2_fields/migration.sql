-- Spec Test v2 (see docs/spec-test-v2-implementation-plan.md §5). Additive except for the
-- unused `phone` column, which nothing in the codebase writes or reads.

-- AlterTable
ALTER TABLE "SpecTestResult"
  ADD COLUMN "instrumentVersion" TEXT NOT NULL DEFAULT 'spec-v1',
  ADD COLUMN "secondarySpec" TEXT,
  ADD COLUMN "motiveScores" JSONB,
  ADD COLUMN "lenses" JSONB,
  ADD COLUMN "attachment" JSONB,
  ADD COLUMN "sparkSpec" TEXT,
  ADD COLUMN "partnershipSpec" TEXT,
  ADD COLUMN "patternFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "resultConfidence" TEXT,
  ADD COLUMN "responseQuality" TEXT,
  ADD COLUMN "contextAnswers" JSONB,
  DROP COLUMN "phone";

-- CreateIndex
CREATE INDEX "SpecTestResult_instrumentVersion_specType_idx" ON "SpecTestResult"("instrumentVersion", "specType");
