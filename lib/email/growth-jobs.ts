import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeUrlFor, isUnsubscribeConfigured } from "@/lib/email/unsubscribe";
import { WeeklyDigestEmail } from "@/components/emails/weekly-digest";
import { WinBackEmail } from "@/components/emails/win-back";
import { MonthlyEarningsEmail } from "@/components/emails/monthly-earnings";

const DIGEST_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000; // just under a week, so a slightly-late cron run doesn't skip one
const WIN_BACK_INACTIVE_MS = 21 * 24 * 60 * 60 * 1000;
const NEW_CREATOR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 200;

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

async function countNewCreatorsInCountry(country: string, sinceMs: number): Promise<number> {
  if (!country) return 0;
  return prisma.profile.count({
    where: { profileType: "CREATOR", country, createdAt: { gte: new Date(Date.now() - sinceMs) } },
  });
}

/**
 * Meant to run weekly (see vercel.json). Only sends to accounts with
 * Profile.marketingEmailsEnabled - the one Phase 5 category that isn't transactional -
 * and skips entirely (no email at all, not even a zero-activity one) when there's
 * genuinely nothing to report, so this never reads as spam.
 */
export async function runWeeklyDigest(): Promise<{ sent: number }> {
  if (!isUnsubscribeConfigured()) return { sent: 0 };

  const cutoffSend = new Date(Date.now() - DIGEST_INTERVAL_MS);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const profiles = await prisma.profile.findMany({
    where: {
      marketingEmailsEnabled: true,
      OR: [{ digestSentAt: null }, { digestSentAt: { lte: cutoffSend } }],
    },
    select: { id: true, profileType: true, country: true, user: { select: { email: true, name: true } } },
    take: BATCH_LIMIT,
  });

  let sent = 0;

  for (const profile of profiles) {
    const firstName = firstNameOf(profile.user.name);
    const unsubscribeUrl = unsubscribeUrlFor(profile.id);

    if (profile.profileType === "CREATOR") {
      const [likeCount, commentCount, newSubscriberCount, topPost] = await Promise.all([
        prisma.postReaction.count({ where: { post: { authorId: profile.id }, createdAt: { gte: since } } }),
        prisma.postComment.count({ where: { post: { authorId: profile.id }, createdAt: { gte: since } } }),
        prisma.providerSubscription.count({ where: { providerId: profile.id, startsAt: { gte: since } } }),
        prisma.post.findFirst({
          where: { authorId: profile.id, createdAt: { gte: since } },
          orderBy: { reactions: { _count: "desc" } },
          select: { content: true },
        }),
      ]);

      if (likeCount + commentCount + newSubscriberCount === 0) {
        await prisma.profile.update({ where: { id: profile.id }, data: { digestSentAt: new Date() } });
        continue;
      }

      await sendEmail({
        to: profile.user.email,
        subject: `Your week on Udala, ${firstName}: ${likeCount} likes, ${newSubscriberCount} new subscribers`,
        react: WeeklyDigestEmail({
          variant: "creator",
          likeCount,
          commentCount,
          newSubscriberCount,
          topPostCaption: topPost?.content || null,
          unsubscribeUrl,
        }),
        category: "digest",
        template: "weekly-digest-creator",
      });
    } else {
      const newCreatorCount = await countNewCreatorsInCountry(profile.country, 7 * 24 * 60 * 60 * 1000);
      if (newCreatorCount === 0) {
        await prisma.profile.update({ where: { id: profile.id }, data: { digestSentAt: new Date() } });
        continue;
      }

      await sendEmail({
        to: profile.user.email,
        subject: `${firstName}, ${newCreatorCount} new creators joined this week`,
        react: WeeklyDigestEmail({ variant: "explorer", newCreatorCount, unsubscribeUrl }),
        category: "digest",
        template: "weekly-digest-explorer",
      });
    }

    await prisma.profile.update({ where: { id: profile.id }, data: { digestSentAt: new Date() } });
    sent += 1;
  }

  return { sent };
}

/**
 * Meant to run daily (see vercel.json). winBackSentAt < lastActiveAt (or null) is what
 * lets this fire again after someone comes back and then goes quiet a second time - no
 * separate reset step needed.
 */
export async function runWinBack(): Promise<{ sent: number }> {
  if (!isUnsubscribeConfigured()) return { sent: 0 };

  const inactiveCutoff = new Date(Date.now() - WIN_BACK_INACTIVE_MS);

  const profiles = await prisma.profile.findMany({
    where: {
      marketingEmailsEnabled: true,
      OR: [
        { lastActiveAt: { lte: inactiveCutoff } },
        { lastActiveAt: null, createdAt: { lte: inactiveCutoff } },
      ],
    },
    select: {
      id: true,
      country: true,
      lastActiveAt: true,
      winBackSentAt: true,
      user: { select: { email: true, name: true } },
    },
    take: BATCH_LIMIT,
  });

  let sent = 0;

  for (const profile of profiles) {
    if (profile.winBackSentAt && profile.lastActiveAt && profile.winBackSentAt >= profile.lastActiveAt) continue;

    const newCreatorCount = await countNewCreatorsInCountry(profile.country, NEW_CREATOR_WINDOW_MS);

    await sendEmail({
      to: profile.user.email,
      subject: `It's quiet without you, ${firstNameOf(profile.user.name)}`,
      react: WinBackEmail({
        firstName: firstNameOf(profile.user.name),
        newCreatorCount,
        unsubscribeUrl: unsubscribeUrlFor(profile.id),
      }),
      category: "digest",
      template: "win-back",
    });

    await prisma.profile.update({ where: { id: profile.id }, data: { winBackSentAt: new Date() } });
    sent += 1;
  }

  return { sent };
}

function monthKeyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Meant to run daily (see vercel.json) - cheap to check every day since
 * earningsSummarySentForMonth already dedupes to once per creator per month, whichever
 * day this happens to run on. Reports new-subscription revenue only (see
 * MonthlyEarningsEmail's own note) - gifts, bookings, and renewals aren't broken out by
 * month anywhere in the schema today.
 */
export async function runMonthlyEarningsSummary(): Promise<{ sent: number }> {
  if (!isUnsubscribeConfigured()) return { sent: 0 };

  const now = new Date();
  const currentMonthKey = monthKeyFor(now);
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthLabel = firstOfLastMonth.toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  const profiles = await prisma.profile.findMany({
    where: {
      profileType: "CREATOR",
      marketingEmailsEnabled: true,
      OR: [{ earningsSummarySentForMonth: null }, { earningsSummarySentForMonth: { not: currentMonthKey } }],
    },
    select: { id: true, user: { select: { email: true } } },
    take: BATCH_LIMIT,
  });

  let sent = 0;

  for (const profile of profiles) {
    const subs = await prisma.providerSubscription.findMany({
      where: { providerId: profile.id, startsAt: { gte: firstOfLastMonth, lt: firstOfThisMonth } },
      select: { id: true, tier: { select: { priceCents: true } } },
    });

    if (subs.length === 0) {
      await prisma.profile.update({ where: { id: profile.id }, data: { earningsSummarySentForMonth: currentMonthKey } });
      continue;
    }

    const revenueCents = subs.reduce((total, sub) => total + sub.tier.priceCents, 0);

    await sendEmail({
      to: profile.user.email,
      subject: `Your Udala earnings for ${lastMonthLabel}`,
      react: MonthlyEarningsEmail({
        month: lastMonthLabel,
        newSubscriptionRevenueCents: revenueCents,
        newSubscriberCount: subs.length,
        unsubscribeUrl: unsubscribeUrlFor(profile.id),
      }),
      category: "digest",
      template: "monthly-earnings",
    });

    await prisma.profile.update({ where: { id: profile.id }, data: { earningsSummarySentForMonth: currentMonthKey } });
    sent += 1;
  }

  return { sent };
}
