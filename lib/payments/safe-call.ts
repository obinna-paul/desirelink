import "server-only";

/**
 * Wraps a confirm-payment call (verifyTransaction + processPaymentEvent) so a
 * bad/stale reference, a double page-load, or a provider hiccup on the
 * redirect-back path never throws mid-render and takes the whole page down
 * with it. The webhook is the source of truth as a fallback for every one of
 * these flows, so swallowing the error here is safe — see each
 * confirm*Payment function's own doc comment.
 */
export async function safeConfirmPayment(action: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(`[payments] ${action} failed to confirm:`, error);
  }
}
