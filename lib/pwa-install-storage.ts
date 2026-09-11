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
