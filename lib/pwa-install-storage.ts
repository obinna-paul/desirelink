/**
 * Durable, cross-visit record that this browser has installed the app. `getInstalledRelatedApps()`
 * (the browser API used to detect an existing install) is the more "correct" signal in theory, but
 * in practice it's tied to the exact manifest identity (id/start_url/scope) at install time - a
 * manifest edit after the user installed can make it silently stop recognizing the install, which
 * re-surfaces the "install" prompt even though the app is already on their home screen. localStorage
 * survives manifest changes entirely, so it's checked first and treated as authoritative once set.
 */
const INSTALLED_KEY = "udala:pwa-installed";

export function hasCompletedInstall(): boolean {
  try {
    return window.localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    // Private browsing or storage disabled - fall back to the browser's own install signals.
    return false;
  }
}

export function markInstallCompleted(): void {
  try {
    window.localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // See hasCompletedInstall - never let a storage failure block anything.
  }
}

/** There's no browser "appuninstalled" event, so this is only called after independently
 *  re-confirming (via getInstalledRelatedApps) that the app is no longer installed. */
export function clearInstallCompleted(): void {
  try {
    window.localStorage.removeItem(INSTALLED_KEY);
  } catch {
    // See hasCompletedInstall.
  }
}

/**
 * Cancelling the install prompt (the banner's own X, declining the browser's native install
 * dialog, or closing the "how to install" instructions) used to only clear in-memory React
 * state - harmless on a real full page reload, but mobile browsers frequently discard and
 * silently reload a backgrounded tab under memory pressure, which remounts the whole app and
 * re-fires `beforeinstallprompt`. That reset the in-memory dismissal on nothing more than a
 * tab switch, which is exactly the "have to keep cancelling it" complaint. Persisting the
 * dismissal here, keyed to the *next local calendar day* rather than a rolling 24h timer (so
 * "ask me again tomorrow" means the next day, not a specific hour that drifts with each
 * dismissal), survives that reload and any other same-day reopen - a fresh browser session
 * the same day stays quiet, and the prompt is only eligible to resurface once a new day
 * actually starts.
 */
const DISMISSED_UNTIL_KEY = "udala:pwa-install-dismissed-until";

function startOfNextLocalDay(from: Date): number {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1).getTime();
}

export function hasDismissedInstallPromptToday(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_UNTIL_KEY);
    if (!raw) return false;
    const dismissedUntil = Number(raw);
    return Number.isFinite(dismissedUntil) && Date.now() < dismissedUntil;
  } catch {
    return false;
  }
}

export function markInstallPromptDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(startOfNextLocalDay(new Date())));
  } catch {
    // See hasCompletedInstall - never let a storage failure block anything.
  }
}
