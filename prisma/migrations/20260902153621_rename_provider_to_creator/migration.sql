-- Rename the ProfileType.PROVIDER value to CREATOR (pure rename, no data loss).
ALTER TYPE "ProfileType" RENAME VALUE 'PROVIDER' TO 'CREATOR';
