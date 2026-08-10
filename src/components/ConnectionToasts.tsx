import { useEffect, useRef } from "react"
import { onNetworkSignal } from "../lib/api"
import { ApiError } from "../lib/api"
import { useToast } from "../lib/toast"

/*
 * The one place connection trouble becomes words. Four sources feed it:
 * the browser's own offline/online events, the API client's experience of
 * its requests (offline, slow, 5xx), the Network Information API where a
 * browser offers it, and errors nothing caught.
 *
 * Every signal carries a cooldown. On shop wifi a bad minute is five failed
 * requests, and five identical toasts teach people to ignore the sixth.
 */

/** Non-standard but real on the Android browsers this PWA lives on */
type NetworkInformation = {
  effectiveType?: string
  addEventListener?: (type: "change", listener: () => void) => void
  removeEventListener?: (type: "change", listener: () => void) => void
}

const COOLDOWN_MS: Record<string, number> = {
  offline: 15_000,
  slow: 60_000,
  "server-error": 30_000,
  crash: 30_000,
}

export function ConnectionToasts() {
  const { showToast } = useToast()
  const lastShown = useRef<Record<string, number>>({})
  const wasOffline = useRef(false)

  useEffect(() => {
    const once = (kind: string, show: () => void) => {
      const now = Date.now()
      if (now - (lastShown.current[kind] ?? 0) < COOLDOWN_MS[kind]) return
      lastShown.current[kind] = now
      show()
    }

    const offline = () => {
      wasOffline.current = true
      once("offline", () =>
        showToast("No internet connection. Working from what is already loaded.", "error"),
      )
    }
    const online = () => {
      /* Only after actually having been offline — browsers fire this on
         boring occasions, and "Back online" out of nowhere reads as noise */
      if (!wasOffline.current) return
      wasOffline.current = false
      lastShown.current.offline = 0
      showToast("Back online.")
    }
    const slow = () =>
      once("slow", () =>
        showToast("Slow connection. Figures may take a moment to arrive.", "error"),
      )

    const unsubscribe = onNetworkSignal((kind) => {
      if (kind === "offline") offline()
      if (kind === "slow") slow()
      if (kind === "server-error") {
        once("server-error", () =>
          showToast("The server had a problem. Try again shortly.", "error"),
        )
      }
    })

    window.addEventListener("offline", offline)
    window.addEventListener("online", online)

    /* Where the browser knows the link quality outright, say so without
       waiting for a request to crawl first */
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
    const checkLink = () => {
      const type = connection?.effectiveType ?? ""
      if (type === "2g" || type === "slow-2g") slow()
    }
    checkLink()
    connection?.addEventListener?.("change", checkLink)

    /* Errors nothing caught: the app stays up, the person hears one honest
       line instead of a silently dead button */
    const crashed = (reason: unknown) =>
      once("crash", () =>
        showToast(
          reason instanceof ApiError ? reason.message : "Something went wrong. Try again.",
          "error",
        ),
      )
    const onRejection = (event: PromiseRejectionEvent) => crashed(event.reason)
    const onError = () => crashed(null)
    window.addEventListener("unhandledrejection", onRejection)
    window.addEventListener("error", onError)

    return () => {
      unsubscribe()
      window.removeEventListener("offline", offline)
      window.removeEventListener("online", online)
      connection?.removeEventListener?.("change", checkLink)
      window.removeEventListener("unhandledrejection", onRejection)
      window.removeEventListener("error", onError)
    }
  }, [showToast])

  return null
}
