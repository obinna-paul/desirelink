-- Gender routing fields (docs/spec-test-gender-report.md §9;
-- docs/spec-test-gender-implementation-plan.md Phase G3). Additive, all nullable - every
-- pre-v2.1 row has none of these and keeps rendering via the "neutral" form.

-- AlterTable
ALTER TABLE "SpecTestResult"
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "routingRule" TEXT,
  ADD COLUMN "assumedAttractionTarget" TEXT,
  ADD COLUMN "quizForm" TEXT;
