CREATE TABLE "SpecTestFormStat" (
    "instrumentVersion" TEXT NOT NULL,
    "quizForm" TEXT NOT NULL,
    "submittedCount" INTEGER NOT NULL DEFAULT 0,
    "lowSignalCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecTestFormStat_pkey" PRIMARY KEY ("instrumentVersion","quizForm")
);
