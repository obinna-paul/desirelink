-- Tiny counter table so the admin dashboard can report a real low-signal rate
-- (docs/spec-test-v2-implementation-plan.md §11 "confidence mix"), even though a
-- low-signal submission is never persisted as its own SpecTestResult row.

-- CreateTable
CREATE TABLE "SpecTestInstrumentStat" (
    "instrumentVersion" TEXT NOT NULL,
    "submittedCount" INTEGER NOT NULL DEFAULT 0,
    "lowSignalCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecTestInstrumentStat_pkey" PRIMARY KEY ("instrumentVersion")
);
