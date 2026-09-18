-- Anonymous, research-only storage for the feature-flagged v3 pilot. No profile/email
-- foreign key is intentional: pilot participation must not identify a respondent by default.
CREATE TABLE "SpecTestPilotSubmission" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT,
    "instrumentVersion" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "attractionProfile" JSONB NOT NULL,
    "uncertaintyProfile" JSONB NOT NULL,
    "qualityFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dataSplit" TEXT NOT NULL DEFAULT 'development',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecTestPilotSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpecTestPilotSubmission_instrumentVersion_createdAt_idx"
ON "SpecTestPilotSubmission"("instrumentVersion", "createdAt");

CREATE INDEX "SpecTestPilotSubmission_instrumentVersion_dataSplit_idx"
ON "SpecTestPilotSubmission"("instrumentVersion", "dataSplit");

CREATE UNIQUE INDEX "SpecTestPilotSubmission_attemptId_key"
ON "SpecTestPilotSubmission"("attemptId");

CREATE TABLE "SpecTestPilotAttempt" (
    "id" TEXT NOT NULL,
    "instrumentVersion" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "highestCompletedIndex" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecTestPilotAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpecTestPilotAttempt_instrumentVersion_highestCompletedIndex_idx"
ON "SpecTestPilotAttempt"("instrumentVersion", "highestCompletedIndex");

CREATE INDEX "SpecTestPilotAttempt_instrumentVersion_completedAt_idx"
ON "SpecTestPilotAttempt"("instrumentVersion", "completedAt");
