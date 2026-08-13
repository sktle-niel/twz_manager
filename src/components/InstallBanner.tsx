import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { DeviceMobileIcon, XIcon } from "@phosphor-icons/react"
import {
  getInstallState,
  isIos,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from "../lib/install"
import { useAuth } from "../lib/session"
import { useToast } from "../lib/toast"

/*
 * The one-time nudge: a device that just signed in and has not installed the
 * app gets thirty seconds of "put this on your home screen" — then it leaves
 * and never returns on this device. The Account page keeps the same offer as
 * a button for anyone who let the banner pass.
 */
const SEEN_KEY = "twz-install-nudged"
const HOLD_MS = 30_000

export function InstallBanner() {
  const { status } = useAuth()
  const { showToast } = useToast()
  const installState = useSyncExternalStore(subscribeInstall, getInstallState)

  /* Armed by the sign-in transition itself — a device that boots already
     signed in has been here before and is not a "new device login" */
  const [armed, setArmed] = useState(false)
  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState(false)
  const prevStatus = useRef(status)

  useEffect(() => {
    const wasOut = prevStatus.current === "signed-out"
    prevStatus.current = status
    if (!wasOut || (status !== "manager" && status !== "owner")) return
    if (isStandalone() || localStorage.getItem(SEEN_KEY) !== null) return
    setArmed(true)
  }, [status])

  /* Opens only once the offer is real: the caught prompt event, or iOS where
     the instructions ARE the offer. Waiting on `installState` covers Chrome
     firing beforeinstallprompt a beat after the sign-in lands. */
  useEffect(() => {
    if (!armed || open) return
    if (installState !== "ready" && !isIos()) return
    if (installState === "installed") {
      setArmed(false)
      return
    }
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
    setOpen(true)
  }, [armed, open, installState])

  // The 30 seconds start when the banner shows, not when it was armed
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setOpen(false), HOLD_MS)
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
      setEntered(false)
    }
  }, [open])

  if (!open) return null

  async function handleInstall() {
    const outcome = await promptInstall()
    setOpen(false)
    setArmed(false)
    if (outcome === "accepted") {
      showToast("Installed — open TWZ Manager from your home screen.")
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
          onClick={() => {
            setOpen(false)
            setArmed(false)
          }}
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
