/** Heuristic, not a hard guarantee - a touch-enabled laptop could false-positive, but
 * that's the same trade-off every "is this a phone" check on the web makes. Shared so
 * PwaInstallPrompt and AppSplash agree on what counts as mobile. */
export function isMobileDevice(): boolean {
  return /Android|iPad|iPhone|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
}
