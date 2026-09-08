import { canChangeUsername, getNextUsernameChangeAt } from "@/lib/username-change";
import { isValidUsernameFormat, normalizeUsername } from "@/lib/username-format";

describe("username change cooldown", () => {
  it("allows a first username change", () => {
    expect(canChangeUsername(null)).toBe(true);
  });

  it("allows another change one calendar month after the previous change", () => {
    const changedAt = new Date("2026-08-08T10:00:00.000Z");
    expect(getNextUsernameChangeAt(changedAt)?.toISOString()).toBe("2026-09-08T10:00:00.000Z");
    expect(canChangeUsername(changedAt, new Date("2026-09-08T09:59:59.000Z"))).toBe(false);
    expect(canChangeUsername(changedAt, new Date("2026-09-08T10:00:00.000Z"))).toBe(true);
  });
});

describe("username format", () => {
  it("accepts lowercase letters, numbers, periods, and underscores only", () => {
    expect(isValidUsernameFormat("obinna.paul_7")).toBe(true);
    expect(isValidUsernameFormat("obinna-paul")).toBe(false);
    expect(isValidUsernameFormat("Obinna.Paul")).toBe(false);
    expect(isValidUsernameFormat("obinna paul")).toBe(false);
    expect(isValidUsernameFormat(".obinna")).toBe(false);
    expect(isValidUsernameFormat("obinna.")).toBe(false);
    expect(normalizeUsername("  Obinna.Paul_7 ")).toBe("obinna.paul_7");
  });
});
