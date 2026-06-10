import { useCallback, useEffect, useMemo, useRef } from "react";

export interface DraftRecord<T> {
  data: T;
  savedAt: number;
}

interface Options<T> {
  /** Unique key per form instance (e.g. `edit-person:<personId>`). */
  key: string;
  /** Current form state. The hook watches this and debounce-saves it. */
  current: T;
  /**
   * When false, the hook is inert — useful while the DB row is loading
   * so we don't write the "empty initial state" over an existing draft.
   */
  enabled: boolean;
  /** Save debounce in ms. Default 1500. */
  debounceMs?: number;
  /**
   * Drafts older than this are ignored on mount (treated as not
   * existing). Default 24h. Prevents an abandoned 3-month-old draft
   * from surprising the user when they come back.
   */
  staleAfterMs?: number;
}

interface Result<T> {
  /**
   * Draft found in localStorage at mount time, or null if none / stale.
   * Capturing it ONCE on mount means the banner doesn't flicker every
   * time we save (the act of saving would otherwise refresh `existing`).
   */
  existing: DraftRecord<T> | null;
  /** Remove the saved draft. Call on successful save or user dismiss. */
  clearDraft: () => void;
}

/**
 * Generic form-draft persistence. Debounce-saves the current form
 * state into localStorage so a mid-edit network drop / tab close
 * doesn't lose work. The hook itself is UI-free — the caller decides
 * whether to silently restore, prompt, or ignore the existing draft
 * (we expose it; we don't apply it).
 *
 * Storage key is namespaced to `ftv3:draft:<caller-key>` so different
 * form types don't collide on the same `personId` etc.
 */
export function useFormDraft<T>({
  key,
  current,
  enabled,
  debounceMs = 1500,
  staleAfterMs = 24 * 60 * 60 * 1000,
}: Options<T>): Result<T> {
  const fullKey = `ftv3:draft:${key}`;

  // Read existing draft ONCE at mount, before any of our own saves
  // could overwrite it. Re-mounting (e.g. on `key` change) re-reads,
  // which is the correct behaviour — different form instance, fresh
  // look at storage.
  const existing = useMemo<DraftRecord<T> | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(fullKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as DraftRecord<T>;
      if (Date.now() - parsed.savedAt > staleAfterMs) {
        window.localStorage.removeItem(fullKey);
        return null;
      }
      return parsed;
    } catch {
      // Corrupt entry from a previous version — drop it silently.
      window.localStorage.removeItem(fullKey);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  // Debounce-save. We do NOT save on the very first render — `enabled`
  // is false until the DB row has loaded, so the initial empty state
  // never lands in storage.
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      const record: DraftRecord<T> = { data: current, savedAt: Date.now() };
      try {
        window.localStorage.setItem(fullKey, JSON.stringify(record));
      } catch {
        // Quota exceeded or storage disabled — silent fallback. The
        // user's primary save (mutation) still works.
      }
    }, debounceMs);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [current, enabled, fullKey, debounceMs]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(fullKey);
  }, [fullKey]);

  return { existing, clearDraft };
}
