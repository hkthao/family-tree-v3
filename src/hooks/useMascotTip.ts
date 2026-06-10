import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { TIP_CATALOGUE, type Tip, type TipContext } from "@/lib/tipCatalogue";

const STORAGE_KEY = "ftv3:tips";
const COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48h between any two tip pops
const CLAN_ID_RE = /^\/clans\/([0-9a-f-]{36})/i;

interface TipsState {
  seenIds: string[];
  lastShownAt: number | null;
  mascotMuted: boolean;
  firstSessionAt: number; // ms epoch, used for sessionAgeMs
  lastSeenVersion: string;
}

function defaultState(): TipsState {
  return {
    seenIds: [],
    lastShownAt: null,
    mascotMuted: false,
    firstSessionAt: 0, // 0 = not yet stamped; load() will set it
    lastSeenVersion: "",
  };
}

function loadState(): TipsState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<TipsState>;
    return {
      seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds : [],
      lastShownAt:
        typeof parsed.lastShownAt === "number" ? parsed.lastShownAt : null,
      mascotMuted: parsed.mascotMuted === true,
      firstSessionAt:
        typeof parsed.firstSessionAt === "number" ? parsed.firstSessionAt : 0,
      lastSeenVersion:
        typeof parsed.lastSeenVersion === "string" ? parsed.lastSeenVersion : "",
    };
  } catch {
    // Corrupt blob from an older format — reset silently.
    window.localStorage.removeItem(STORAGE_KEY);
    return defaultState();
  }
}

function saveState(s: TipsState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Quota / storage disabled — ignore. Tips are a nice-to-have.
  }
}

export interface UseMascotTipResult {
  tip: Tip | null;
  /** Mark current tip as seen + persist. */
  dismiss: () => void;
  /** Hide the bubble without marking seen (e.g. click outside).
   *  Tip will re-appear if eligible on next route. */
  hide: () => void;
  /** User clicked the mascot directly — bypass cooldown and pick
   *  any unseen eligible tip right now. `excludeIds` skips tips
   *  already shown in the current open session (so repeated clicks
   *  cycle to fresh content). Returns null when the catalogue is
   *  exhausted relative to the current context. */
  peek: (excludeIds?: string[]) => Tip | null;
  /** Toggle the user-level mute. */
  setMuted: (muted: boolean) => void;
  muted: boolean;
}

/**
 * Picks one eligible tip per cycle, respects cooldown + seen-ids +
 * mute. Returns `null` when there's nothing to show.
 *
 * Re-evaluates whenever the route changes — simplest trigger, and
 * matches how users tend to ask questions ("now I'm on this page,
 * what should I know?"). Could be extended later to also re-check
 * on focus or on a timer.
 */
export function useMascotTip(): UseMascotTipResult {
  const location = useLocation();
  const [state, setState] = useState<TipsState>(() => loadState());
  const [tip, setTip] = useState<Tip | null>(null);

  // Stamp firstSessionAt on the very first load so sessionAgeMs
  // works even for users who installed the app a week ago.
  useEffect(() => {
    if (state.firstSessionAt !== 0) return;
    const stamped = { ...state, firstSessionAt: Date.now() };
    setState(stamped);
    saveState(stamped);
  }, [state]);

  // Pick a tip when route / state changes. Pure read — doesn't mark
  // seen yet; that happens on dismiss so a user closing without
  // reading isn't "considered served".
  useEffect(() => {
    if (state.mascotMuted) {
      setTip(null);
      return;
    }
    if (state.lastShownAt && Date.now() - state.lastShownAt < COOLDOWN_MS) {
      setTip(null);
      return;
    }

    const clanMatch = CLAN_ID_RE.exec(location.pathname);
    const ctx: TipContext = {
      route: location.pathname,
      // __APP_VERSION__ is replaced at build time by vite.
      appVersion: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "",
      lastSeenVersion: state.lastSeenVersion,
      clanId: clanMatch ? clanMatch[1] : null,
      sessionAgeMs: state.firstSessionAt
        ? Date.now() - state.firstSessionAt
        : 0,
      seenCount: state.seenIds.length,
    };

    const eligible = TIP_CATALOGUE.filter((t) => !state.seenIds.includes(t.id))
      .filter((t) => {
        try {
          return t.when(ctx);
        } catch {
          return false;
        }
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    setTip(eligible[0] ?? null);
  }, [location.pathname, state]);

  const dismiss = useCallback(() => {
    if (!tip) return;
    const next: TipsState = {
      ...state,
      seenIds: state.seenIds.includes(tip.id)
        ? state.seenIds
        : [...state.seenIds, tip.id],
      lastShownAt: Date.now(),
      // Stamp the version once user has seen any tip so the
      // app-updated tip doesn't keep firing on every route change.
      lastSeenVersion:
        typeof __APP_VERSION__ !== "undefined"
          ? __APP_VERSION__
          : state.lastSeenVersion,
    };
    setState(next);
    saveState(next);
    setTip(null);
  }, [state, tip]);

  const hide = useCallback(() => {
    setTip(null);
  }, []);

  const peek = useCallback(
    (excludeIds: string[] = []): Tip | null => {
      if (typeof window === "undefined") return null;
      const clanMatch = CLAN_ID_RE.exec(window.location.pathname);
      const ctx: TipContext = {
        route: window.location.pathname,
        appVersion:
          typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "",
        lastSeenVersion: state.lastSeenVersion,
        clanId: clanMatch ? clanMatch[1] : null,
        sessionAgeMs: state.firstSessionAt
          ? Date.now() - state.firstSessionAt
          : 0,
        seenCount: state.seenIds.length,
      };
      const eligible = TIP_CATALOGUE.filter(
        (t) => !state.seenIds.includes(t.id) && !excludeIds.includes(t.id),
      )
        .filter((t) => {
          try {
            return t.when(ctx);
          } catch {
            return false;
          }
        })
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      // Fall back to any eligible tip route-agnostically when nothing
      // matches the current route — user clicked the mascot looking
      // for content, give them content. Welcome / mute hints / app-
      // updated work anywhere so this almost always has something.
      let next = eligible[0] ?? null;
      if (!next) {
        const fallback = TIP_CATALOGUE.filter(
          (t) =>
            !state.seenIds.includes(t.id) && !excludeIds.includes(t.id),
        ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        next = fallback[0] ?? null;
      }
      setTip(next);
      return next;
    },
    [state],
  );

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
    dismiss,
    hide,
    peek,
    setMuted,
    muted: state.mascotMuted,
  };
}
