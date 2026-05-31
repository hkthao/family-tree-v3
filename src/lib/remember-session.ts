import { supabase } from "@/lib/supabase";

/**
 * "Ghi nhớ đăng nhập" semantics.
 *
 * Checked (default): standard Supabase behaviour — the JWT lives in
 *   localStorage and survives browser restarts; user is auto-signed-in
 *   next time.
 * Unchecked: session still works for the current browsing window
 *   (so reload + tab navigation work normally), but the next time the
 *   user opens the app *fresh* — close + reopen — they're signed out
 *   before they can act.
 *
 * Detecting "fresh load vs reload" uses the Navigation Timing API:
 * navigationEntry.type === "reload" only on F5 / Cmd+R. A genuine new
 * tab / window opening to the app reports "navigate". Browsers without
 * the API report nothing → we treat that as "fresh" too, on the
 * conservative side.
 */

const KEY = "family-tree:remember";

export function setRememberPreference(remember: boolean): void {
  try {
    localStorage.setItem(KEY, remember ? "true" : "false");
  } catch {
    /* ignore: private mode */
  }
}

export function getRememberPreference(): boolean {
  try {
    // Default is "remember" (true) — that matches the unchanged
    // historical behaviour.
    return localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
}

function isReload(): boolean {
  if (typeof performance === "undefined") return false;
  const entries = performance.getEntriesByType("navigation");
  const first = entries[0] as PerformanceNavigationTiming | undefined;
  return first?.type === "reload";
}

/**
 * Call once on app startup. If the user previously chose "không ghi
 * nhớ" and this load isn't a reload, drop the session right now so the
 * router sends them back to /login.
 */
export async function applyRememberOnAppStart(): Promise<void> {
  if (getRememberPreference()) return;
  if (isReload()) return;
  await supabase.auth.signOut();
}
