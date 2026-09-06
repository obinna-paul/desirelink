"use client";

const SESSION_ID_KEY = "udala_session_id";

/** A per-tab id, stable for the life of that tab (sessionStorage, not localStorage) - lets
 * ranking-adjacent signals (impressions, search interactions) group events from the same
 * visit without identifying the viewer beyond what they're already authenticated as. */
export function getClientSessionId(): string {
  if (typeof window === "undefined") return "";

  try {
    let id = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    // Private-browsing / storage-disabled contexts - degrade to no session grouping
    // rather than throwing.
    return "";
  }
}
