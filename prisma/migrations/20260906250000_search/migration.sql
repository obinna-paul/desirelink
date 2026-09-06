-- Unified Postgres full-text search. First CREATE EXTENSION and first tsvector/trigram
-- usage in this codebase - a deliberate architectural addition, not an accident.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Postgres requires a GENERATED ALWAYS column's expression to be IMMUTABLE, but
-- unaccent() itself is only STABLE (it depends on a text search dictionary lookup) - the
-- standard workaround is an IMMUTABLE wrapper naming the dictionary explicitly, since the
-- unaccent dictionary is not something that changes at runtime in practice.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- CreateTable
CREATE TABLE "SearchDocument" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "searchVector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', immutable_unaccent(coalesce("title", ''))), 'A') ||
        setweight(to_tsvector('simple', immutable_unaccent(coalesce("body", ''))), 'B')
    ) STORED,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchInteraction" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT,
    "query" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchDocument_entityType_entityId_key" ON "SearchDocument"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SearchDocument_entityType_idx" ON "SearchDocument"("entityType");

-- CreateIndex
CREATE INDEX "SearchDocument_searchVector_idx" ON "SearchDocument" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "SearchDocument_title_trgm_idx" ON "SearchDocument" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SearchInteraction_viewerId_idx" ON "SearchInteraction"("viewerId");

-- CreateIndex
CREATE INDEX "SearchInteraction_createdAt_idx" ON "SearchInteraction"("createdAt");

-- AddForeignKey
ALTER TABLE "SearchInteraction" ADD CONSTRAINT "SearchInteraction_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
