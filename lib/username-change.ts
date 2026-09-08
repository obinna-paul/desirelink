import { addMonths } from "date-fns";

export const USERNAME_CHANGE_COOLDOWN_MONTHS = 1;

export function getNextUsernameChangeAt(lastChangedAt: Date | string | null): Date | null {
  if (!lastChangedAt) return null;
  return addMonths(new Date(lastChangedAt), USERNAME_CHANGE_COOLDOWN_MONTHS);
}

export function canChangeUsername(lastChangedAt: Date | string | null, now = new Date()): boolean {
  const nextChangeAt = getNextUsernameChangeAt(lastChangedAt);
  return !nextChangeAt || nextChangeAt.getTime() <= now.getTime();
}
