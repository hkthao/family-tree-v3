import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { TIP_CATALOGUE, type Tip, type TipContext } from "@/lib/tipCatalogue";

const STORAGE_KEY = "ftv3:tips";
// How often the mascot auto-pops a fresh tip while the user is
// idle. Long enough not to nag, short enough to feel like a quiet
// assistant — 3 minutes is the current calibration.
const POP_INTERVAL_MS = 3 * 60 * 1000;
const CLAN_ID_RE = /^\/clans\/([0-9a-f-]{36})/i;

interface TipsState {
  /** User-level "I don't want hints" — only persistent flag we keep. */
  mascotMuted: boolean;
  /** Stamp of first session so sessionAgeMs predicate is meaningful. */
  firstSessionAt: number;
  /** Last app version the user has clicked through a tip in. Lets
   *  the app-updated tip pop ONCE per new version rather than on
   *  every interval. */
  lastSeenVersion: string;
}

function defaultState(): TipsState {
  return { mascotMuted: false, firstSessionAt: 0, lastSeenVersion: "" };
}

function loadState(): TipsState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<TipsState>;
    return {
      mascotMuted: parsed.mascotMuted === true,
      firstSessionAt:
        typeof parsed.firstSessionAt === "number" ? parsed.firstSessionAt : 0,
      lastSeenVersion:
        typeof parsed.lastSeenVersion === "string"
          ? parsed.lastSeenVersion
          : "",
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return defaultState();
  }
}

function saveState(s: TipsState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota / disabled — ignore */
  }
}

function buildContext(state: TipsState): TipContext {
  const clanMatch =
    typeof window !== "undefined"
      ? CLAN_ID_RE.exec(window.location.pathname)
      : null;
  return {
    route: typeof window !== "undefined" ? window.location.pathname : "/",
    appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "",
    lastSeenVersion: state.lastSeenVersion,
    clanId: clanMatch ? clanMatch[1] : null,
    sessionAgeMs: state.firstSessionAt ? Date.now() - state.firstSessionAt : 0,
    seenCount: 0,
  };
}

function pickEligible(
  state: TipsState,
  recentIds: string[],
): Tip | null {
  const ctx = buildContext(state);
  const eligible = TIP_CATALOGUE.filter((t) => !recentIds.includes(t.id))
    .filter((t) => {
      try {
        return t.when(ctx);
      } catch {
        return false;
      }
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  // No more route-matching tips left in this rotation — fall back
  // to ANY unused tip so the user keeps getting fresh content.
  let next: Tip | null = eligible[0] ?? null;
  if (!next) {
    next =
      TIP_CATALOGUE.filter((t) => !recentIds.includes(t.id)).sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
      )[0] ?? null;
  }
  return next;
}

export interface UseMascotTipResult {
  tip: Tip | null;
  /** Hide the current bubble (without marking dismissed forever).
   *  Next interval will pop the next-in-rotation tip. */
  hide: () => void;
  /** Click on the mascot — cycle to a different unseen-in-this-
   *  rotation tip immediately. */
  cycle: () => Tip | null;
  /** Toggle the user-level mute. */
  setMuted: (muted: boolean) => void;
  muted: boolean;
}

/**
 * Periodic mascot tip system. Every POP_INTERVAL_MS the hook picks
 * a fresh tip (one we haven't shown yet in this rotation), the
 * component pops a bubble for it, auto-hides after a few seconds.
 * Tips are never marked "dismissed forever" — the rotation just
 * cycles through and starts over.
 *
 * The single persistent flag is `mascotMuted`: user opts out
 * completely. Otherwise tips keep rotating.
 */
export function useMascotTip(): UseMascotTipResult {
  const location = useLocation();
  const [state, setState] = useState<TipsState>(() => loadState());
  const [tip, setTip] = useState<Tip | null>(null);
  // Per-rotation memory: tips already shown since the rotation
  // started. Resets when all tips are exhausted so we loop cleanly.
  const recentIdsRef = useRef<string[]>([]);

  // Stamp firstSessionAt on the very first load so sessionAgeMs
  // predicates can fire.
  useEffect(() => {
    if (state.firstSessionAt !== 0) return;
    const next = { ...state, firstSessionAt: Date.now() };
    setState(next);
    saveState(next);
  }, [state]);

  // Bump lastSeenVersion the first time we see this build — keeps
  // the app-updated tip from re-firing every interval after the
  // user has been on the new version for a while.
  useEffect(() => {
    if (state.mascotMuted) return;
    const v = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
    if (!v) return;
    if (state.lastSeenVersion === v) return;
    // Only stamp AFTER the user has been on the new version for a
    // few minutes, so the app-updated tip has time to pop once.
    const t = window.setTimeout(
      () => {
        const next = { ...state, lastSeenVersion: v };
        setState(next);
        saveState(next);
      },
      5 * 60 * 1000,
    );
    return () => window.clearTimeout(t);
  }, [state]);

  // The periodic timer — fires every POP_INTERVAL_MS while mounted.
  // location.pathname is in the deps so the context refreshes when
  // the user navigates (the next pop picks tips that match the new
  // route).
  useEffect(() => {
    if (state.mascotMuted) {
      setTip(null);
      return;
    }
    function popNext() {
      let next = pickEligible(state, recentIdsRef.current);
      if (!next) {
        // Catalogue exhausted in this rotation — reset and try again.
        recentIdsRef.current = [];
        next = pickEligible(state, []);
      }
      if (next) {
        recentIdsRef.current = [...recentIdsRef.current, next.id];
        setTip(next);
      }
    }
    // Fire one tip after a short warmup so a fresh route load isn't
    // immediately interrupted by a popup.
    const warmup = window.setTimeout(popNext, 15_000);
    const interval = window.setInterval(popNext, POP_INTERVAL_MS);
    return () => {
      window.clearTimeout(warmup);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mascotMuted, location.pathname]);

  const hide = useCallback(() => {
    setTip(null);
  }, []);

  const cycle = useCallback((): Tip | null => {
    const current = tip;
    const skip = current
      ? [...recentIdsRef.current, current.id]
      : recentIdsRef.current;
    let next = pickEligible(state, skip);
    if (!next) {
      recentIdsRef.current = current ? [current.id] : [];
      next = pickEligible(state, recentIdsRef.current);
    }
    if (next) {
      recentIdsRef.current = [...skip, next.id];
      setTip(next);
    }
    return next;
  }, [state, tip]);

  const setMuted = useCallback(
    (muted: boolean) => {
      const next = { ...state, mascotMuted: muted };
      setState(next);
      saveState(next);
      if (muted) setTip(null);
    },
    [state],
  );

  return {
    tip,
    hide,
    cycle,
    setMuted,
    muted: state.mascotMuted,
  };
}
