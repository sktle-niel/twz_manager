import { useEffect, useState } from "react"
import { BellRingingIcon } from "@phosphor-icons/react"
import { ApiError } from "../lib/api"
import { pushSupported, subscribeAndRegister, unsubscribeAndForget } from "../lib/push"
import { useToast } from "../lib/toast"

/*
 * Reminders on this device: the evening "log your expenses" and the morning
 * "days are waiting for a deposit" nudges, delivered as web push so they
 * arrive with the app closed. The manager shell turns these on by itself
 * (src/lib/push.ts), so this card is mostly the off switch and the recovery
 * door — one switch per browser; turning it off forgets only this device.
 */
type PushState = "checking" | "unsupported" | "blocked" | "off" | "on" | "busy"

export function NotificationsCard() {
  const { showToast } = useToast()
  const [state, setState] = useState<PushState>("checking")

  useEffect(() => {
    let live = true
    async function look() {
      if (!pushSupported()) {
        if (live) setState("unsupported")
        return
      }
      if (Notification.permission === "denied") {
        if (live) setState("blocked")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (live) setState(subscription ? "on" : "off")
    }
    look().catch(() => {
      if (live) setState("unsupported")
    })
    return () => {
      live = false
    }
  }, [])

  async function turnOn() {
    setState("busy")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off")
        return
      }
      await subscribeAndRegister()
      setState("on")
      showToast("Reminders are on for this device.")
    } catch (err) {
      setState("off")
      showToast(err instanceof ApiError ? err.message : "Reminders could not be turned on. Try again.")
    }
  }

  async function turnOff() {
    setState("busy")
    try {
      await unsubscribeAndForget()
      setState("off")
      showToast("Reminders are off for this device.")
    } catch (err) {
      setState("on")
      showToast(err instanceof ApiError ? err.message : "That did not save. Try again.")
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" data-rise>
      <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
        <BellRingingIcon size={16} weight="bold" aria-hidden="true" />
        Reminders
      </h2>
      <p className="mt-1 text-[13px] leading-[1.55] text-mute">
        A nudge on this device when the day's expenses are not logged by evening, and when
        audited days are piling up without a deposit. They arrive even with the app closed.
      </p>

      {state === "unsupported" && (
        <p className="mt-3 text-[13px] leading-[1.55] text-ink-soft">
          This browser cannot receive reminders. On iPhone, add the app to the Home Screen
          first — reminders work from there.
        </p>
      )}
      {state === "blocked" && (
        <p className="mt-3 text-[13px] leading-[1.55] text-ink-soft">
          Notifications are blocked for this site. Allow them in the browser's site settings,
          then come back here.
        </p>
      )}
      {(state === "on" || state === "off" || state === "busy" || state === "checking") && (
        <button
          type="button"
          disabled={state === "busy" || state === "checking"}
          onClick={() => void (state === "on" ? turnOff() : turnOn())}
          className={`mt-4 flex h-11 items-center justify-center rounded-lg px-5 text-[14.5px] font-medium transition-colors duration-200 ease-quiet disabled:pointer-events-none disabled:opacity-60 ${
            state === "on"
              ? "border border-line-strong text-ink hover:bg-black/[0.03]"
              : "bg-ink text-white hover:bg-[#2e2f2b]"
          }`}
        >
          {state === "on" ? "Turn off on this device" : "Turn on reminders"}
        </button>
      )}
      {state === "on" && (
        <p className="mt-2 text-[12.5px] text-mute">Reminders are on for this device.</p>
      )}
    </section>
  )
}
