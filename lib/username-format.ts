export const USERNAME_PATTERN = /^[a-z0-9_][a-z0-9._]{1,18}[a-z0-9_]$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsernameFormat(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}
