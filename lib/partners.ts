import { prisma } from "@/lib/prisma";

const PARTNER_SUMMARY_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;

export type PartnerSummary = { id: string; username: string; displayName: string; avatarUrl: string };

export type PartnerInviteView = {
  id: string;
  createdAt: Date;
  profile: PartnerSummary;
};

export type PartnerState = {
  partner: PartnerSummary | null;
  incoming: PartnerInviteView[];
  outgoing: PartnerInviteView[];
};

export async function getPartnerState(profileId: string): Promise<PartnerState> {
  const [profile, incoming, outgoing] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: profileId },
      select: { partner: { select: PARTNER_SUMMARY_SELECT } },
    }),
    prisma.partnerInvite.findMany({
      where: { toProfileId: profileId, status: "pending" },
      select: { id: true, createdAt: true, fromProfile: { select: PARTNER_SUMMARY_SELECT } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnerInvite.findMany({
      where: { fromProfileId: profileId, status: "pending" },
      select: { id: true, createdAt: true, toProfile: { select: PARTNER_SUMMARY_SELECT } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    partner: profile?.partner ?? null,
    incoming: incoming.map((invite) => ({
      id: invite.id,
      createdAt: invite.createdAt,
      profile: invite.fromProfile,
    })),
    outgoing: outgoing.map((invite) => ({
      id: invite.id,
      createdAt: invite.createdAt,
      profile: invite.toProfile,
    })),
  };
}

export type PartnerActionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

async function linkPartners(profileAId: string, profileBId: string, acceptedInviteId: string) {
  await prisma.$transaction([
    prisma.profile.update({ where: { id: profileAId }, data: { partnerId: profileBId } }),
    prisma.profile.update({ where: { id: profileBId }, data: { partnerId: profileAId } }),
    prisma.partnerInvite.update({ where: { id: acceptedInviteId }, data: { status: "accepted" } }),
    prisma.partnerInvite.updateMany({
      where: {
        id: { not: acceptedInviteId },
        status: "pending",
        OR: [
          { fromProfileId: { in: [profileAId, profileBId] } },
          { toProfileId: { in: [profileAId, profileBId] } },
        ],
      },
      data: { status: "cancelled" },
    }),
  ]);
}

export async function sendPartnerInvite(
  fromProfileId: string,
  username: string
): Promise<PartnerActionResult> {
  const fromProfile = await prisma.profile.findUnique({
    where: { id: fromProfileId },
    select: { id: true, accountType: true, partnerId: true },
  });

  if (!fromProfile) {
    return { ok: false, status: 404, error: "Profile not found" };
  }

  if (fromProfile.accountType !== "pair") {
    return { ok: false, status: 403, error: "Only Pair accounts can link a partner." };
  }

  if (fromProfile.partnerId) {
    return { ok: false, status: 400, error: "You're already linked to a partner. Unlink first." };
  }

  const toProfile = await prisma.profile.findUnique({
    where: { username },
    select: { id: true, accountType: true, partnerId: true },
  });

  if (!toProfile) {
    return { ok: false, status: 404, error: "No profile found for that username." };
  }

  if (toProfile.id === fromProfileId) {
    return { ok: false, status: 400, error: "You can't link to yourself." };
  }

  if (toProfile.accountType !== "pair") {
    return { ok: false, status: 400, error: "That profile isn't set up as a Pair account." };
  }

  if (toProfile.partnerId) {
    return { ok: false, status: 409, error: "That profile is already linked to a partner." };
  }

  const reverseInvite = await prisma.partnerInvite.findUnique({
    where: { fromProfileId_toProfileId: { fromProfileId: toProfile.id, toProfileId: fromProfileId } },
  });

  if (reverseInvite && reverseInvite.status === "pending") {
    await linkPartners(fromProfileId, toProfile.id, reverseInvite.id);
    return { ok: true };
  }

  const existingInvite = await prisma.partnerInvite.findUnique({
    where: { fromProfileId_toProfileId: { fromProfileId, toProfileId: toProfile.id } },
  });

  if (existingInvite) {
    if (existingInvite.status === "pending") {
      return { ok: false, status: 409, error: "You've already sent this profile an invite." };
    }
    await prisma.partnerInvite.update({
      where: { id: existingInvite.id },
      data: { status: "pending" },
    });
    return { ok: true };
  }

  await prisma.partnerInvite.create({
    data: { fromProfileId, toProfileId: toProfile.id, status: "pending" },
  });

  return { ok: true };
}

export async function respondToPartnerInvite(
  profileId: string,
  inviteId: string,
  accept: boolean
): Promise<PartnerActionResult> {
  const invite = await prisma.partnerInvite.findUnique({ where: { id: inviteId } });

  if (!invite || invite.toProfileId !== profileId || invite.status !== "pending") {
    return { ok: false, status: 404, error: "Invite not found" };
  }

  if (!accept) {
    await prisma.partnerInvite.update({ where: { id: inviteId }, data: { status: "declined" } });
    return { ok: true };
  }

  const [fromProfile, toProfile] = await Promise.all([
    prisma.profile.findUnique({ where: { id: invite.fromProfileId }, select: { partnerId: true } }),
    prisma.profile.findUnique({ where: { id: invite.toProfileId }, select: { partnerId: true } }),
  ]);

  if (fromProfile?.partnerId || toProfile?.partnerId) {
    await prisma.partnerInvite.update({ where: { id: inviteId }, data: { status: "cancelled" } });
    return { ok: false, status: 409, error: "One of you is already linked to a partner." };
  }

  await linkPartners(invite.fromProfileId, invite.toProfileId, invite.id);
  return { ok: true };
}

export async function cancelPartnerInvite(
  profileId: string,
  inviteId: string
): Promise<PartnerActionResult> {
  const invite = await prisma.partnerInvite.findUnique({ where: { id: inviteId } });

  if (!invite || invite.fromProfileId !== profileId || invite.status !== "pending") {
    return { ok: false, status: 404, error: "Invite not found" };
  }

  await prisma.partnerInvite.update({ where: { id: inviteId }, data: { status: "cancelled" } });
  return { ok: true };
}

export async function unlinkPartner(profileId: string): Promise<PartnerActionResult> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { partnerId: true },
  });

  if (!profile?.partnerId) {
    return { ok: false, status: 400, error: "You don't have a linked partner." };
  }

  await prisma.$transaction([
    prisma.profile.update({ where: { id: profileId }, data: { partnerId: null } }),
    prisma.profile.update({ where: { id: profile.partnerId }, data: { partnerId: null } }),
  ]);

  return { ok: true };
}
