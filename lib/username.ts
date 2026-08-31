import { prisma } from "@/lib/prisma";

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsernameFormat(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export async function isUsernameAvailable(username: string, excludeProfileId?: string): Promise<boolean> {
  const existing = await prisma.profile.findUnique({ where: { username }, select: { id: true } });
  return !existing || existing.id === excludeProfileId;
}

export async function generateUniqueUsername(email: string) {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20) || "user";

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await prisma.profile.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
  }

  return `${base}${Date.now()}`;
}
