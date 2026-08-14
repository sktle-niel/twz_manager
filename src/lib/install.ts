/*
 * The browser's install offer, caught and kept. Chrome-family browsers fire
 * `beforeinstallprompt` once, early — usually before any component that wants
 * it has mounted — so a module-level listener holds the event and React reads
 * it through useSyncExternalStore. iOS never fires it; there the install path
 * is Safari's own Share → Add to Home Screen, and the UI says so instead.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/** What the device can do right now, not what it might do later */
export type InstallState = "installed" | "ready" | "unavailable"

export type InstallOutcome = "accepted" | "dismissed" | "unavailable"

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/** Already running from the home screen — installing again means nothing */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

window.addEventListener("beforeinstallprompt", (e) => {
  // Chrome's own mini-infobar yields to the app's banner and button
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  notify()
})

window.addEventListener("appinstalled", () => {
  deferred = null
  installed = true
  notify()
})

export function getInstallState(): InstallState {
  if (installed || isStandalone()) return "installed"
  return deferred ? "ready" : "unavailable"
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Opens the browser's real install dialog; resolves with the user's answer */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred
  if (!event) return "unavailable"
  await event.prompt()
  const choice = await event.userChoice
  /* Either way the event is spent — prompt() works once per event. Chrome
     fires a fresh beforeinstallprompt when it is willing to offer again. */
  deferred = null
  if (choice.outcome === "accepted") {
    // `appinstalled` confirms this moments later; flipping now keeps the UI honest in the gap
    installed = true
    notify()
    return "accepted"
  }
  notify()
  return "dismissed"
}
