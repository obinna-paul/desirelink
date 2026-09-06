-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "interestsPromptShownAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileTopic" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "ProfileTopic_profileId_idx" ON "ProfileTopic"("profileId");

-- CreateIndex
CREATE INDEX "ProfileTopic_topicId_idx" ON "ProfileTopic"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileTopic_profileId_topicId_key" ON "ProfileTopic"("profileId", "topicId");

-- AddForeignKey
ALTER TABLE "ProfileTopic" ADD CONSTRAINT "ProfileTopic_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileTopic" ADD CONSTRAINT "ProfileTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the curated topic taxonomy (~24-40 rows per the discovery/ranking plan). There is
-- no seed-script tooling in this repo, so curated reference data is inserted directly by
-- its introducing migration - ON CONFLICT keeps this safe to re-run.
INSERT INTO "Topic" ("id", "slug", "name") VALUES
    ('topic-fitness', 'fitness', 'Fitness & Gym'),
    ('topic-travel', 'travel', 'Travel'),
    ('topic-foodie', 'foodie', 'Food & Dining'),
    ('topic-nightlife', 'nightlife', 'Nightlife'),
    ('topic-music', 'music', 'Music'),
    ('topic-movies-tv', 'movies-tv', 'Movies & TV'),
    ('topic-gaming', 'gaming', 'Gaming'),
    ('topic-books', 'books', 'Books & Reading'),
    ('topic-art-design', 'art-design', 'Art & Design'),
    ('topic-photography', 'photography', 'Photography'),
    ('topic-fashion', 'fashion', 'Fashion & Style'),
    ('topic-wellness', 'wellness', 'Wellness & Mindfulness'),
    ('topic-outdoors', 'outdoors', 'Outdoors & Adventure'),
    ('topic-pets', 'pets', 'Pets & Animals'),
    ('topic-comedy', 'comedy', 'Comedy & Humor'),
    ('topic-sports', 'sports', 'Sports'),
    ('topic-tech', 'tech', 'Tech & Gadgets'),
    ('topic-cars', 'cars', 'Cars & Motorsports'),
    ('topic-cooking', 'cooking', 'Cooking & Baking'),
    ('topic-dance', 'dance', 'Dance'),
    ('topic-spirituality', 'spirituality', 'Spirituality'),
    ('topic-volunteering', 'volunteering', 'Volunteering & Causes'),
    ('topic-parenting', 'parenting', 'Parenting'),
    ('topic-astrology', 'astrology', 'Astrology'),
    ('topic-anime', 'anime', 'Anime & Comics'),
    ('topic-diy-crafts', 'diy-crafts', 'DIY & Crafts'),
    ('topic-coffee', 'coffee', 'Coffee Culture'),
    ('topic-lgbtq', 'lgbtq', 'LGBTQ+ Community')
ON CONFLICT ("slug") DO NOTHING;
