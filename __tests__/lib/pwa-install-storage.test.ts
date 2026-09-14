import {
  hasDismissedInstallPromptToday,
  markInstallPromptDismissed,
} from "@/lib/pwa-install-storage";

describe("pwa-install-storage - same-day dismissal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    window.localStorage.clear();
  });

  it("reports no dismissal when nothing has been recorded", () => {
    expect(hasDismissedInstallPromptToday()).toBe(false);
  });

  it("stays dismissed for the rest of the same calendar day", () => {
    jest.setSystemTime(new Date(2026, 0, 15, 9, 0, 0));
    markInstallPromptDismissed();

    jest.setSystemTime(new Date(2026, 0, 15, 23, 59, 0));
    expect(hasDismissedInstallPromptToday()).toBe(true);
  });

  it("is no longer dismissed once a new calendar day starts, even a minute after midnight", () => {
    jest.setSystemTime(new Date(2026, 0, 15, 23, 30, 0));
    markInstallPromptDismissed();

    jest.setSystemTime(new Date(2026, 0, 16, 0, 1, 0));
    expect(hasDismissedInstallPromptToday()).toBe(false);
  });
});
