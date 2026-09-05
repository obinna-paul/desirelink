import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { CeoNoteEmail } from "@/components/emails/ceo-note";
import { ProfileNudgeEmail } from "@/components/emails/profile-nudge";

const CEO_NOTE_DELAY_MS = 2 * 60 * 60 * 1000; // a few hours after verifying
const PROFILE_NUDGE_DELAY_MS = 48 * 60 * 60 * 1000; // 48 hours after signup
const BATCH_LIMIT = 100;

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

/**
 * Meant to run every 30 minutes (see vercel.json). Sends Paul's one-time personal note
 * a few hours after a user verifies their email, and never again - dedupe is
 * Profile.ceoNoteSentAt, set right after the send succeeds (or is skipped because
 * emailing failed - see the doc comment on sendEmail: it never throws, so this always
 * marks the attempt as made rather than retrying forever on a bad address).
 */
export async function runCeoWelcomeNotes(): Promise<{ sent: number }> {
  const cutoff = new Date(Date.now() - CEO_NOTE_DELAY_MS);

  const users = await prisma.user.findMany({
    where: {
      emailVerified: { not: null, lte: cutoff },
      profile: { ceoNoteSentAt: null },
    },
    select: { id: true, email: true, name: true, profile: { select: { id: true, profileType: true } } },
    take: BATCH_LIMIT,
  });

  for (const user of users) {
    if (!user.profile) continue;

    await sendEmail({
      to: user.email,
      subject: `Hey ${firstNameOf(user.name)}, it's Paul`,
      react: CeoNoteEmail({ firstName: firstNameOf(user.name), isCreator: user.profile.profileType === "CREATOR" }),
      category: "welcome",
      template: "ceo-note",
      from: "paul",
    });

    await prisma.profile.update({ where: { id: user.profile.id }, data: { ceoNoteSentAt: new Date() } });
  }

  return { sent: users.length };
}

/**
 * Meant to run daily (see vercel.json). Nudges anyone whose profile is still missing a
 * photo or bio 48 hours after signup, once - dedupe is Profile.profileNudgeSentAt.
 */
export async function runProfileNudges(): Promise<{ sent: number }> {
  const cutoff = new Date(Date.now() - PROFILE_NUDGE_DELAY_MS);

  const users = await prisma.user.findMany({
    where: {
      createdAt: { lte: cutoff },
      profile: {
        profileNudgeSentAt: null,
        OR: [{ avatarUrl: "" }, { bio: "" }],
      },
    },
    select: {
      email: true,
      name: true,
      profile: { select: { id: true, avatarUrl: true, bio: true } },
    },
    take: BATCH_LIMIT,
  });

  for (const user of users) {
    if (!user.profile) continue;

    const missingField = user.profile.avatarUrl === "" ? "a profile photo" : "a bio";

    await sendEmail({
      to: user.email,
      subject: `Your profile is still missing something, ${firstNameOf(user.name)}`,
      react: ProfileNudgeEmail({ firstName: firstNameOf(user.name), missingField }),
      category: "welcome",
      template: "profile-nudge",
    });

    await prisma.profile.update({ where: { id: user.profile.id }, data: { profileNudgeSentAt: new Date() } });
  }

  return { sent: users.length };
}
