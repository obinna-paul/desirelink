import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isValidUsernameFormat, normalizeUsername } from "@/lib/username-format";
export { USERNAME_PATTERN, isValidUsernameFormat, normalizeUsername } from "@/lib/username-format";

export async function isUsernameAvailable(username: string, excludeProfileId?: string): Promise<boolean> {
  const normalized = normalizeUsername(username);
  if (!isValidUsernameFormat(normalized)) return false;

  const existing = await prisma.profile.findUnique({ where: { username: normalized }, select: { id: true } });
  if (existing && existing.id !== excludeProfileId) return false;

  try {
    const alias = await prisma.usernameAlias.findUnique({
      where: { username: normalized },
      select: { profileId: true },
    });
    return !alias || alias.profileId === excludeProfileId;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return !existing || existing.id === excludeProfileId;
    }
    throw error;
  }
}

export async function generateUniqueUsername(email: string) {
  const emailBase =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20);
  const base = (emailBase.length >= 3 ? emailBase : `user${emailBase}`).slice(0, 20) || "user";

  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = attempt === 0 ? "" : String(Math.floor(1000 + Math.random() * 9000));
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    if (await isUsernameAvailable(candidate)) return candidate;
  }

  while (true) {
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const candidate = `${base.slice(0, 7)}_${suffix}`;
    if (await isUsernameAvailable(candidate)) return candidate;
  }
}
