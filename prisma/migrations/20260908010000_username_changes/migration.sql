-- Preserve previous handles so existing profile links and @mentions remain valid.
CREATE TABLE "UsernameAlias" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsernameAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsernameAlias_username_key" ON "UsernameAlias"("username");
CREATE INDEX "UsernameAlias_profileId_changedAt_idx" ON "UsernameAlias"("profileId", "changedAt");

ALTER TABLE "UsernameAlias"
ADD CONSTRAINT "UsernameAlias_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
