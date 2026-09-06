import { prisma } from "@/lib/prisma";

/** Caps how many interests a profile can pick - generous enough for real signal, small
 * enough to keep the picker and any later affinity scoring meaningful. */
export const MAX_INTERESTS_PER_PROFILE = 10;

export type TopicOption = { id: string; slug: string; name: string };

export async function getAllTopics(): Promise<TopicOption[]> {
  return prisma.topic.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getProfileTopicIds(profileId: string): Promise<string[]> {
  const rows = await prisma.profileTopic.findMany({
    where: { profileId },
    select: { topicId: true },
  });
  return rows.map((row) => row.topicId);
}

/**
 * Re-derives a profile's selected interests from a submitted list of topic ids - used by
 * both the onboarding picker and the Profile → Edit interests section. Silently drops any
 * id that isn't a real Topic (stale client, tampered request) rather than erroring, and
 * caps at MAX_INTERESTS_PER_PROFILE.
 */
export async function setProfileInterests(profileId: string, topicIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(topicIds)).slice(0, MAX_INTERESTS_PER_PROFILE);

  const validTopics =
    uniqueIds.length === 0
      ? []
      : await prisma.topic.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true },
        });
  const validIds = new Set(validTopics.map((topic) => topic.id));

  await prisma.profileTopic.deleteMany({ where: { profileId } });
  if (validIds.size === 0) return;

  await prisma.profileTopic.createMany({
    data: Array.from(validIds).map((topicId) => ({ profileId, topicId })),
    skipDuplicates: true,
  });
}
