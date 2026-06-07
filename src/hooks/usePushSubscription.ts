import { useCallback, useEffect, useState } from "react";

import {
  deleteMyPushSubscription,
  upsertMyPushSubscription,
} from "@/lib/queries/push";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

type PermissionState = NotificationPermission | "unsupported";

export type PushState =
  | "unsupported" // browser missing PushManager/Notification
  | "ios-not-standalone" // iOS Safari outside A2HS — cannot subscribe
  | "denied"
  | "default" // permission not yet granted
  | "subscribed" // permission granted + DB row exists
  | "loading"; // permission granted but sync still in-flight

export interface UsePushSubscriptionResult {
  state: PushState;
  /** Endpoint of the active browser subscription, when known. */
  endpoint: string | null;
  error: string | null;
  /** Drive the full opt-in flow: prompt → subscribe → upsert DB row. */
  enable: () => Promise<void>;
  /** Unsubscribe locally + delete DB row. */
  disable: () => Promise<void>;
}

/**
 * Encapsulates the Web Push opt-in flow. The hook intentionally does
 * NOT call Notification.requestPermission() on mount — the system
 * prompt only fires after the user clicks the explicit toggle. This
 * matches the UX guidance in plan §29.7.
 *
 * Permission revocation drift: on mount, if Notification.permission
 * is "denied" but a browser subscription still exists, the hook
 * cleans up the DB row so we don't try to push to a black hole.
 */
export function usePushSubscription(): UsePushSubscriptionResult {
  const [state, setState] = useState<PushState>("loading");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setError(null);
    const support = detectSupport();
    if (support !== "supported") {
      setState(support);
      return;
    }

    const perm: PermissionState = Notification.permission;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (perm === "denied") {
      // Drift cleanup: keep DB clean when browser-level permission
      // was flipped off behind our back.
      if (existing) {
        try {
          await existing.unsubscribe();
          await deleteMyPushSubscription(existing.endpoint);
        } catch {
          // best-effort; don't surface
        }
      }
      setEndpoint(null);
      setState("denied");
      return;
    }

    if (existing) {
      setEndpoint(existing.endpoint);
      setState("subscribed");
    } else {
      setEndpoint(null);
      setState(perm === "granted" ? "default" : "default");
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  const enable = useCallback(async () => {
    setError(null);
    if (!VAPID_PUBLIC_KEY) {
      setError("VITE_VAPID_PUBLIC_KEY chưa cấu hình");
      return;
    }
    try {
      const support = detectSupport();
      if (support !== "supported") {
        setState(support);
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast to BufferSource — TS 5.7+ tightened Uint8Array's buffer
        // narrowing so the default `Uint8Array<ArrayBufferLike>` no
        // longer satisfies BufferSource (which requires ArrayBuffer
        // specifically). The runtime value is identical.
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY,
        ) as unknown as BufferSource,
      });
      const json = sub.toJSON() as {
        keys?: { p256dh?: string; auth?: string };
      };
      const p256dh = json.keys?.p256dh ?? "";
      const auth = json.keys?.auth ?? "";
      if (!p256dh || !auth) {
        throw new Error("Subscription thiếu key — thử lại");
      }
      await upsertMyPushSubscription({
        endpoint: sub.endpoint,
        p256dh,
        auth,
        userAgent: navigator.userAgent.slice(0, 200),
      });
      setEndpoint(sub.endpoint);
      setState("subscribed");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const disable = useCallback(async () => {
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        await deleteMyPushSubscription(existing.endpoint);
      }
      setEndpoint(null);
      setState("default");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  return { state, endpoint, error, enable, disable };
}

// ─── Helpers ─────────────────────────────────────────────────────

function detectSupport():
  | "supported"
  | "unsupported"
  | "ios-not-standalone" {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window)) return "unsupported";
  if (!("Notification" in window)) return "unsupported";

  // iOS detection: Web Push only works when launched from a home-
  // screen icon (PWA standalone mode), and only from iOS 16.4+.
  // Detection uses standalone matchMedia + Safari-specific
  // navigator.standalone — no UA sniff.
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !("MSStream" in window);
  if (isIOS) {
    const isStandalone =
      ("standalone" in navigator &&
        (navigator as unknown as { standalone?: boolean }).standalone ===
          true) ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) return "ios-not-standalone";
  }
  return "supported";
}

/**
 * Convert URL-safe base64 (the VAPID public key) to the Uint8Array
 * `pushManager.subscribe` expects.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
