-- Keep circle configuration idempotent and prevent duplicate membership/permission rows.
DELETE FROM "CirclePermission" a
USING "CirclePermission" b
WHERE a."id" > b."id"
  AND a."circleId" = b."circleId"
  AND a."fieldName" = b."fieldName";

DELETE FROM "CircleMember" a
USING "CircleMember" b
WHERE a."id" > b."id"
  AND a."circleId" = b."circleId"
  AND a."userId" = b."userId";

DELETE FROM "Circle" a
USING "Circle" b
WHERE a."id" > b."id"
  AND a."userId" = b."userId"
  AND a."name" = b."name";

CREATE UNIQUE INDEX "Circle_userId_name_key" ON "Circle"("userId", "name");
CREATE UNIQUE INDEX "CircleMember_circleId_userId_key" ON "CircleMember"("circleId", "userId");
CREATE UNIQUE INDEX "CirclePermission_circleId_fieldName_key" ON "CirclePermission"("circleId", "fieldName");
