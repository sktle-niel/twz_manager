import { useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { DeviceMobileIcon, XIcon } from "@phosphor-icons/react"
import {
  getInstallState,
  isIos,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from "../lib/install"
import { useToast } from "../lib/toast"

/*
 * The door greeter: every visit that could end with the app on the home
 * screen opens with this offer — login page included, no waiting for a
 * sign-in. One tap runs the browser's real install dialog and the icon lands
 * by itself; nobody digs through a browser menu. Dismissing holds for this
 * visit only — the next visit asks again, until the app is actually
 * installed. The Account page keeps the same offer as a standing button.
 */
const DISMISS_KEY = "twz-install-dismissed"

export function InstallBanner() {
  const { showToast } = useToast()
  const installState = useSyncExternalStore(subscribeInstall, getInstallState)

  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) !== null,
  )
  const [entered, setEntered] = useState(false)

  /* Opens the moment the offer is real: Chrome's caught prompt event, or iOS,
     where the Share-sheet instructions ARE the offer. `installed` covers the
     appinstalled event landing mid-session. */
  const open =
    !dismissed &&
    installState !== "installed" &&
    !isStandalone() &&
    (installState === "ready" || isIos())

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => {
      cancelAnimationFrame(raf)
      setEntered(false)
    }
  }, [open])

  if (!open) return null

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setDismissed(true)
  }

  async function handleInstall() {
    const outcome = await promptInstall()
    if (outcome === "accepted") {
      showToast("Installed — open TWZ Manager from your home screen.")
    } else if (outcome === "dismissed") {
      // "No" to the browser's dialog is a "no" for this visit, not forever
      dismiss()
    }
  }

  return createPortal(
    <div
      className={`fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 transition-[opacity,transform] duration-300 ease-quiet lg:bottom-6 ${
        entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <div
        role="status"
        className="flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-[0_8px_24px_rgba(21,22,19,0.14)]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage text-sage-ink">
          <DeviceMobileIcon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">Install TWZ Manager</p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-mute">
            {isIos() && installState !== "ready"
              ? "Tap Share, then “Add to Home Screen” — it opens full screen, like a real app."
              : "Add it to this device’s home screen — it opens full screen, like a real app."}
          </p>
          {installState === "ready" && (
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="mt-2.5 flex h-9 items-center justify-center rounded-lg bg-ink px-4 text-[13.5px] font-medium text-white transition-colors duration-200 ease-quiet hover:bg-[#2e2f2b]"
            >
              Install to this device
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
        >
          <XIcon size={15} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
