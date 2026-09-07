/**
 * Tracks whether the app-open splash has been shown this "session," in the sense of a
 * real app: sessionStorage survives a page refresh and backgrounding/resuming the app
 * (same browsing context, same tab), but not the app being fully closed and reopened
 * (a new browsing context gets fresh, empty sessionStorage) - so the splash naturally
 * reappears on a real relaunch without any extra bookkeeping. Signing out explicitly
 * clears the flag (see clearSplashSeen, called from SignOutButton) so signing back in
 * shows it again too, which sessionStorage's own lifecycle can't express on its own
 * since a logout/login round trip usually stays in the same tab.
 */
const SPLASH_SEEN_KEY = "udala:splash-seen";

export function hasSeenSplash(): boolean {
  try {
    return window.sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
  } catch {
    // Private browsing or storage disabled - treat as unseen; showing the splash an
    // extra time is harmless, silently failing to persist is not a bug to surface.
    return false;
  }
}

export function markSplashSeen(): void {
  try {
    window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
  } catch {
    // See hasSeenSplash - never let a storage failure block dismissal.
  }
}

export function clearSplashSeen(): void {
  try {
    window.sessionStorage.removeItem(SPLASH_SEEN_KEY);
  } catch {
    // See hasSeenSplash - never let a storage failure block signing out.
  }
}
