-- Development/hold-out assignment (docs/spec-test-v2-implementation-plan.md §12
-- "Hold-out tagging"), so a future psychometric refit can validate on data it never fit on.

-- AlterTable
ALTER TABLE "SpecTestResult" ADD COLUMN "dataSplit" TEXT NOT NULL DEFAULT 'development';
