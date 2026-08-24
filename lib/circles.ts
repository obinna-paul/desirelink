import type { Prisma } from "@prisma/client";

import { DESIRE_CATEGORIES } from "@/lib/desire-options";
import { prisma } from "@/lib/prisma";

export const PROFILE_FIELD_PERMISSIONS = [
  {
    key: "bio",
    label: "Bio",
    description: "Your profile introduction.",
  },
  {
    key: "location",
    label: "Location",
    description: "City and country on your profile.",
  },
  {
    key: "identity",
    label: "Identity",
    description: "Gender and orientation.",
  },
  {
    key: "availability",
    label: "Availability",
    description: "Open to chat and meet signals.",
  },
] as const;

export type ProfileFieldName = (typeof PROFILE_FIELD_PERMISSIONS)[number]["key"];

export const PROFILE_FIELD_NAMES = PROFILE_FIELD_PERMISSIONS.map((field) => field.key);
export const PUBLIC_PROFILE_FIELD_NAMES: ProfileFieldName[] = ["bio"];
export const ALL_PROFILE_FIELD_NAMES: ProfileFieldName[] = [...PROFILE_FIELD_NAMES];

export function isProfileFieldName(value: string): value is ProfileFieldName {
  return PROFILE_FIELD_NAMES.includes(value as ProfileFieldName);
}

export function desirePermissionKey(category: string) {
  return `desire:${category}`;
}

export function parseDesirePermissionKey(fieldName: string) {
  return fieldName.startsWith("desire:") ? fieldName.slice("desire:".length) : null;
}

export const CIRCLE_INCLUDE = {
  members: {
    include: {
      profile: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  permissions: {
    orderBy: { fieldName: "asc" },
  },
} satisfies Prisma.CircleInclude;

export type CircleWithDetails = Prisma.CircleGetPayload<{ include: typeof CIRCLE_INCLUDE }>;

export type ProfileVisibility = {
  profileFields: ProfileFieldName[];
  desireCategories: string[];
  circleNames: string[];
};

export function buildPermissionFieldNames(input: {
  profileFields: ProfileFieldName[];
  desireCategories: string[];
}) {
  return [
    ...input.profileFields,
    ...input.desireCategories.map((category) => desirePermissionKey(category)),
  ];
}

export function buildPermissionRows(
  circleId: string,
  input: {
    profileFields: ProfileFieldName[];
    desireCategories: string[];
  }
): Prisma.CirclePermissionCreateManyInput[] {
  return buildPermissionFieldNames(input).map((fieldName) => ({
    circleId,
    fieldName,
    visible: true,
  }));
}

export async function getOwnedCircles(profileId: string) {
  return prisma.circle.findMany({
    where: { userId: profileId },
    orderBy: { createdAt: "asc" },
    include: CIRCLE_INCLUDE,
  });
}

export async function getProfileVisibility(
  profileId: string,
  viewerProfileId: string | null,
  isOwner: boolean
): Promise<ProfileVisibility> {
  if (isOwner) {
    return {
      profileFields: ALL_PROFILE_FIELD_NAMES,
      desireCategories: [...DESIRE_CATEGORIES],
      circleNames: [],
    };
  }

  const profileFields = new Set<ProfileFieldName>(PUBLIC_PROFILE_FIELD_NAMES);
  const desireCategories = new Set<string>();

  if (!viewerProfileId) {
    return { profileFields: Array.from(profileFields), desireCategories: [], circleNames: [] };
  }

  const memberships = await prisma.circleMember.findMany({
    where: { userId: viewerProfileId, circle: { userId: profileId } },
    include: { circle: { include: { permissions: true } } },
  });

  for (const membership of memberships) {
    for (const permission of membership.circle.permissions) {
      if (!permission.visible) continue;

      if (isProfileFieldName(permission.fieldName)) {
        profileFields.add(permission.fieldName);
        continue;
      }

      const desireCategory = parseDesirePermissionKey(permission.fieldName);
      if (desireCategory) {
        desireCategories.add(desireCategory);
      }
    }
  }

  return {
    profileFields: Array.from(profileFields),
    desireCategories: Array.from(desireCategories),
    circleNames: memberships.map((membership) => membership.circle.name),
  };
}

export async function getVisibleDesires(profileId: string, visibility: ProfileVisibility) {
  return prisma.desire.findMany({
    where: {
      userId: profileId,
      OR: [
        { privacy: "public" },
        ...(visibility.desireCategories.length > 0
          ? [{ category: { in: visibility.desireCategories } }]
          : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}
