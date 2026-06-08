/* eslint-disable */
// Custom service worker push handlers — supports interactive (2-way)
// notifications backed by the public.notifications table.
//
// Push payload contract (from notify-* Edge Functions):
//   Minimal interactive:  { notification_id, action_token, title, body, url }
//   Legacy plain:         { title, body, url, tag }
//
// Interactive flow:
//   1. Push arrives with notification_id + action_token.
//   2. SW calls get_notification_by_token (anon RPC) to read the
//      row's `actions[]` array + payload context.
//   3. showNotification with action buttons matching the row.
//   4. On notificationclick: if event.action is one of the rendered
//      actions, POST to push-action with {notification_id,
//      action_token, action_id}. Otherwise just open the deep-link.
//
// iOS < 16.4 + Safari macOS: actions[] is ignored silently. Users
// can still tap the body to open the app. Graceful fallback.

const SUPABASE_URL = "__VITE_SUPABASE_URL__"; // replaced at SW boot below
const SUPABASE_ANON_KEY = "__VITE_SUPABASE_ANON_KEY__";

// In dev/local, the SW is served from the dev server; in prod the
// origin matches the deployed app. We resolve from registration.scope
// instead of hardcoding so the same SW file works in both.
let supabaseBase = "";
let supabaseKey = "";
async function ensureSupabaseConfig() {
  if (supabaseBase) return;
  try {
    // The main app posts the config on registration via postMessage
    // (see src/lib/pwa.ts). Use that as primary source.
    const cached = await caches
      .open("sw-config-v1")
      .then((c) => c.match("/__sw_config__"))
      .then((res) => (res ? res.json() : null));
    if (cached?.supabaseUrl) {
      supabaseBase = cached.supabaseUrl;
      supabaseKey = cached.supabaseAnonKey || "";
    }
  } catch (_) {
    /* ignore */
  }
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "sw-config" && data.supabaseUrl) {
    supabaseBase = data.supabaseUrl;
    supabaseKey = data.supabaseAnonKey || "";
    // Persist so future SW restarts have it.
    event.waitUntil(
      caches.open("sw-config-v1").then((cache) =>
        cache.put(
          "/__sw_config__",
          new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
  }
});

const ACTION_LABELS = {
  approve: "Duyệt",
  reject: "Từ chối",
  confirm: "Xác nhận",
  revoke: "Thu hồi",
  acknowledge: "Đã thắp hương",
};

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      data = { body: event.data ? event.data.text() : "" };
    } catch (_) {
      data = {};
    }
  }

  const title = data.title || "Gia phả";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge.png",
    tag: data.tag || undefined,
    data: {
      url: data.url || "/",
      notification_id: data.notification_id || null,
      action_token: data.action_token || null,
    },
    requireInteraction: true,
  };

  // If the payload carries a notification_id, try to fetch the row
  // and surface actions[]. Tolerate failure — we still show the
  // notification body even if the fetch flops.
  if (data.notification_id && data.action_token) {
    try {
      await ensureSupabaseConfig();
      if (supabaseBase) {
        const res = await fetch(
          `${supabaseBase}/rest/v1/rpc/get_notification_by_token`,
          {
            method: "POST",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_notification_id: data.notification_id,
              p_action_token: data.action_token,
            }),
          },
        );
        if (res.ok) {
          const row = await res.json();
          const actions = Array.isArray(row?.actions) ? row.actions : [];
          // Web Notifications API accepts at most 2 actions visible
          // on most platforms. Take the first two.
          options.actions = actions.slice(0, 2).map((id) => ({
            action: id,
            title: ACTION_LABELS[id] || id,
          }));
        }
      }
    } catch (_) {
      /* SW network blip — still show the body-only notification */
    }
  }

  await self.registration.showNotification(title, options);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, notification_id, action_token } = event.notification.data || {};
  const target = url || "/";
  const actionId = event.action;

  if (actionId && notification_id && action_token) {
    event.waitUntil(handleAction(notification_id, action_token, actionId, target));
    return;
  }

  event.waitUntil(openDeepLink(target));
});

async function handleAction(notificationId, actionToken, actionId, fallbackUrl) {
  await ensureSupabaseConfig();
  if (!supabaseBase) return openDeepLink(fallbackUrl);
  try {
    const res = await fetch(`${supabaseBase}/functions/v1/push-action`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notification_id: notificationId,
        action_token: actionToken,
        action_id: actionId,
      }),
    });
    if (!res.ok) {
      // Dispatch failed — fall back to opening the app so user can
      // finish the action manually.
      return openDeepLink(fallbackUrl);
    }
    // Brief confirmation toast as a fresh notification (no actions).
    const confirm = await res.json().catch(() => ({}));
    const label =
      confirm.action === "approved"
        ? "Đã duyệt đề xuất"
        : confirm.action === "rejected"
          ? "Đã từ chối đề xuất"
          : "Đã ghi nhận";
    await self.registration.showNotification("Gia phả", {
      body: label,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge.png",
      tag: `confirm:${notificationId}`,
    });
  } catch (_) {
    return openDeepLink(fallbackUrl);
  }
}

async function openDeepLink(target) {
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clientList) {
    if ("focus" in client) {
      client.postMessage({ type: "push-nav", url: target });
      return client.focus();
    }
  }
  return self.clients.openWindow(target);
}
