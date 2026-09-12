-- CreateTable
CREATE TABLE "SpecTestResult" (
    "id" TEXT NOT NULL,
    "specType" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "profileId" TEXT,
    "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecTestResult_email_idx" ON "SpecTestResult"("email");

-- CreateIndex
CREATE INDEX "SpecTestResult_profileId_idx" ON "SpecTestResult"("profileId");

-- AddForeignKey
ALTER TABLE "SpecTestResult" ADD CONSTRAINT "SpecTestResult_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
