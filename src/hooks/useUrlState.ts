import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-query-param state for list pages.
 *
 * Why: list pages keep tab / search / page / filters in local state.
 * Navigating into a detail route unmounts the list, so pressing Back
 * remounts it fresh and the user loses their tab + search. Storing the
 * value in the query string instead means the browser's Back button
 * restores the exact URL — and therefore the state — for free. Bonus:
 * the view becomes shareable / bookmarkable and survives a refresh.
 *
 * A param is dropped from the URL when its value is empty so default
 * views stay on a clean `/clans` URL.
 *
 * `replace` (default true): filter/search updates rewrite the current
 * history entry in place, so Back doesn't step through every keystroke
 * or filter tweak. The one push that matters — list → detail — happens
 * via the row's <Link>, so Back still returns to the list with its
 * last-used filters intact.
 *
 * IMPORTANT: react-router's functional `setSearchParams` reads the
 * *render-time* params, not a live ref. So two separate setters firing
 * in one event handler clobber each other (the second starts from the
 * same base and wins). When a single action must change more than one
 * param — e.g. "change filter AND reset page to 1" — use {@link
 * useUrlPatch} to write them in ONE call instead of chaining setters.
 */
export function useUrlState(
  key: string,
  defaultValue: string,
  options: { replace?: boolean } = {},
): [string, (next: string) => void] {
  const { replace = true } = options;
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === defaultValue || next === "") p.delete(key);
          else p.set(key, next);
          return p;
        },
        { replace },
      );
    },
    [key, defaultValue, replace, setParams],
  );

  return [value, setValue];
}

/**
 * Returns a setter that patches several query params atomically in a
 * single history update. Pass `null` (or "") for a key to remove it
 * (e.g. reset `page` back to its default). Use this whenever one user
 * action touches multiple params so they don't clobber each other —
 * see the note on {@link useUrlState}.
 */
export function useUrlPatch(): (
  updates: Record<string, string | null>,
  options?: { replace?: boolean },
) => void {
  const [, setParams] = useSearchParams();
  return useCallback(
    (updates, options = {}) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [key, val] of Object.entries(updates)) {
            if (val == null || val === "") p.delete(key);
            else p.set(key, val);
          }
          return p;
        },
        { replace: options.replace ?? true },
      );
    },
    [setParams],
  );
}
