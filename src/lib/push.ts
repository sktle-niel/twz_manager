/*
 * Web-push reminders, in one place: the subscribe/unsubscribe plumbing the
 * Account page's card uses, and the auto-enable pass the manager shell runs
 * on boot. Reminders are meant to be ON by default — a branch manager should
 * never have to find a settings card to learn the day's expenses were not
 * logged — so every boot of the manager area makes sure this device is
 * subscribed, asking for permission once per visit until it is granted.
 *
 * What a browser will not allow is turning notifications on with no consent
 * at all: the permission dialog is the one tap that cannot be skipped. Once
 * it has been allowed, everything after is automatic — a cleared
 * subscription, a reinstall, or a re-enabled account quietly resubscribes
 * on the next open.
 */
import { api } from "./api"

/* Asked-this-visit marker, so a "not now" holds until the next visit —
   the same manner the install banner keeps */
const NUDGE_KEY = "twz-push-nudged"

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window
}

/** Subscribes this browser and registers the mailbox to the signed-in account */
export async function subscribeAndRegister(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const key = await api.pushKey()
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  })
  await register(subscription)
}

/** Forgets this browser's mailbox, server first so a failure never orphans it */
export async function unsubscribeAndForget(): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await api.deletePushSubscription(subscription.endpoint)
    await subscription.unsubscribe()
  }
}

/**
 * The default-on pass, run when the manager area boots. Quiet by design —
 * failures here leave the Account page's card as the loud, manual door.
 */
export async function ensureRemindersOn(): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission === "denied") return

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      /* Already subscribed — re-register so the mailbox belongs to whoever
         is signed in NOW, and so a server-side cleanup (a re-enabled
         account, a fresh database) gets the row back */
      await register(subscription)
      return
    }

    if (Notification.permission === "default") {
      /* iOS only shows this dialog on a tap, so there the card stays the
         way in; Chrome and Android ask right here. Once per visit. */
      if (sessionStorage.getItem(NUDGE_KEY) !== null) return
      sessionStorage.setItem(NUDGE_KEY, new Date().toISOString())
      const permission = await Notification.requestPermission()
      if (permission !== "granted") return
    }

    await subscribeAndRegister()
  } catch {
    // Silent: the standing card on the Account page is the loud path
  }
}

async function register(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  await api.savePushSubscription({
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
  })
}
