import { prisma } from "@/lib/prisma";
import { recalculateReputation } from "@/lib/reputation";

export const REVIEW_CONTEXT_TYPES = ["event", "transaction"] as const;
export type ReviewContextType = (typeof REVIEW_CONTEXT_TYPES)[number];

export function isReviewContextType(value: unknown): value is ReviewContextType {
  return typeof value === "string" && (REVIEW_CONTEXT_TYPES as readonly string[]).includes(value);
}

const MAX_COMMENT_LENGTH = 1000;

async function attendedEventIds(profileId: string): Promise<Set<string>> {
  const [hosted, going] = await Promise.all([
    prisma.event.findMany({ where: { hostId: profileId }, select: { id: true } }),
    prisma.eventRsvp.findMany({
      where: { userId: profileId, status: "going" },
      select: { eventId: true },
    }),
  ]);
  return new Set([...hosted.map((e) => e.id), ...going.map((r) => r.eventId)]);
}

async function canReviewEvent(reviewerId: string, revieweeId: string, eventId: string): Promise<boolean> {
  const [reviewerEvents, revieweeEvents] = await Promise.all([
    attendedEventIds(reviewerId),
    attendedEventIds(revieweeId),
  ]);
  return reviewerEvents.has(eventId) && revieweeEvents.has(eventId);
}

async function canReviewTransaction(
  reviewerId: string,
  revieweeId: string,
  transactionId: string
): Promise<boolean> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { userId: true, status: true, tier: { select: { creatorId: true } } },
  });
  if (!transaction || transaction.status !== "succeeded" || !transaction.tier) {
    return false;
  }

  const parties = [transaction.userId, transaction.tier.creatorId];
  return parties.includes(reviewerId) && parties.includes(revieweeId);
}

export type ReviewableContext = { contextType: ReviewContextType; contextId: string; label: string };

/** Shared events attended together and completed subscription transactions between the two, not yet reviewed. */
export async function getReviewableContexts(
  reviewerId: string,
  revieweeId: string
): Promise<ReviewableContext[]> {
  if (reviewerId === revieweeId) return [];

  const [reviewerEvents, revieweeEvents, transactions, existingReviews] = await Promise.all([
    attendedEventIds(reviewerId),
    attendedEventIds(revieweeId),
    prisma.transaction.findMany({
      where: {
        status: "succeeded",
        tierId: { not: null },
        OR: [
          { userId: reviewerId, tier: { creatorId: revieweeId } },
          { userId: revieweeId, tier: { creatorId: reviewerId } },
        ],
      },
      select: { id: true, tier: { select: { name: true } } },
    }),
    prisma.review.findMany({
      where: { reviewerId, revieweeId },
      select: { contextType: true, contextId: true },
    }),
  ]);

  const reviewedKeys = new Set(existingReviews.map((r) => `${r.contextType}:${r.contextId}`));
  const sharedEventIds = Array.from(reviewerEvents).filter((id) => revieweeEvents.has(id));

  const events = sharedEventIds.length
    ? await prisma.event.findMany({ where: { id: { in: sharedEventIds } }, select: { id: true, title: true } })
    : [];

  const contexts: ReviewableContext[] = [];

  for (const event of events) {
    if (!reviewedKeys.has(`event:${event.id}`)) {
      contexts.push({ contextType: "event", contextId: event.id, label: event.title });
    }
  }
  for (const transaction of transactions) {
    if (!reviewedKeys.has(`transaction:${transaction.id}`)) {
      contexts.push({
        contextType: "transaction",
        contextId: transaction.id,
        label: `${transaction.tier?.name ?? "Membership"} subscription`,
      });
    }
  }

  return contexts;
}

export type SubmitReviewResult =
  | { ok: true; reviewId: string }
  | { ok: false; status: number; error: string };

export async function submitReview(
  reviewerId: string,
  revieweeId: string,
  contextType: ReviewContextType,
  contextId: string,
  rating: number,
  comment: string
): Promise<SubmitReviewResult> {
  if (reviewerId === revieweeId) {
    return { ok: false, status: 400, error: "You can't review yourself" };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, status: 400, error: "Rating must be between 1 and 5" };
  }

  const trimmedComment = comment.trim();
  if (trimmedComment.length > MAX_COMMENT_LENGTH) {
    return { ok: false, status: 400, error: `Comment must be under ${MAX_COMMENT_LENGTH} characters` };
  }

  const eligible =
    contextType === "event"
      ? await canReviewEvent(reviewerId, revieweeId, contextId)
      : await canReviewTransaction(reviewerId, revieweeId, contextId);

  if (!eligible) {
    return {
      ok: false,
      status: 403,
      error: "You can only review someone after attending an event together or completing a transaction with them",
    };
  }

  const existing = await prisma.review.findUnique({
    where: {
      reviewerId_revieweeId_contextType_contextId: { reviewerId, revieweeId, contextType, contextId },
    },
  });
  if (existing) {
    return { ok: false, status: 400, error: "You've already reviewed this" };
  }

  const review = await prisma.review.create({
    data: { reviewerId, revieweeId, contextType, contextId, rating, comment: trimmedComment },
  });

  await recalculateReputation(revieweeId);

  return { ok: true, reviewId: review.id };
}

const reviewerSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

export async function getReviewsForProfile(profileId: string, limit = 50) {
  return prisma.review.findMany({
    where: { revieweeId: profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { reviewer: { select: reviewerSelect } },
  });
}

export type ReviewData = Awaited<ReturnType<typeof getReviewsForProfile>>[number];

export type ReviewSummary = { averageRating: number; totalCount: number };

export async function getReviewSummary(profileId: string): Promise<ReviewSummary> {
  const result = await prisma.review.aggregate({
    where: { revieweeId: profileId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return {
    averageRating: result._avg.rating ?? 0,
    totalCount: result._count._all,
  };
}
