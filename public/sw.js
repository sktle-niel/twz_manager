/*
 * The app's service worker exists for one job: web-push reminders. No
 * precaching, no offline shell — a stale asset cache is a debugging trap
 * this app has no need to walk into, and the reminders work without one.
 */
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    /* A payload that is not JSON still deserves a notification shell */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "TWZ Manager", {
      body: data.body || "",
      icon: "/twz-icon-192.png",
      badge: "/twz-icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/" },
    }),
  )
})

/* Tapping the notification lands on the page it talks about — an existing
   app window is reused and steered there rather than opening a second one */
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
