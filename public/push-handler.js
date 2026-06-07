/* eslint-disable */
// Custom service worker push handlers.
//
// Loaded via workbox importScripts in vite.config.ts so it lives
// alongside the auto-generated PWA service worker without forcing us
// to switch the whole project to injectManifest strategy.
//
// Payload shape from notify-events Edge Function:
//   { title, body, url, tag }
//
// `tag` is the event_key — devices receiving the same event collapse
// to a single notification. `url` is a same-origin deep link; the SW
// always opens it through clients.openWindow so login redirect kicks
// in for unauthenticated users.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    // Payload wasn't JSON — fall back to text body if available.
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
    data: { url: data.url || "/" },
    // Keep giỗ reminders visible until tap — elders often miss
    // transient banners. Birthdays are short-lived enough that this
    // is fine for both event kinds.
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open, focus that window and navigate
        // it to the deep link via postMessage so React Router takes
        // over instead of a full page reload.
        for (const client of clientList) {
          if ("focus" in client) {
            client.postMessage({ type: "push-nav", url: target });
            return client.focus();
          }
        }
        // No tab open — open a fresh one.
        return self.clients.openWindow(target);
      }),
  );
});
