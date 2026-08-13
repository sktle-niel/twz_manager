import { useState, useSyncExternalStore } from "react"
import { DeviceMobileIcon } from "@phosphor-icons/react"
import {
  getInstallState,
  isIos,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from "../lib/install"
import { useToast } from "../lib/toast"

/*
 * The standing install offer on the Account page — for everyone who let the
 * post-sign-in banner slip past. Inside the installed app the card would only
 * describe itself, so there it does not render at all.
 */
export function InstallCard() {
  const { showToast } = useToast()
  const state = useSyncExternalStore(subscribeInstall, getInstallState)
  const [busy, setBusy] = useState(false)

  if (isStandalone()) return null

  async function handleInstall() {
    setBusy(true)
    try {
      const outcome = await promptInstall()
      if (outcome === "accepted") {
        showToast("Installed — open TWZ Manager from your home screen.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" data-rise>
      <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
        <DeviceMobileIcon size={16} weight="bold" aria-hidden="true" />
        Install app
      </h2>
      <p className="mt-1 text-[13px] leading-[1.55] text-mute">
        Put TWZ Manager on this device&rsquo;s home screen. It opens full screen with its own
        icon — like a native app, no browser bar.
      </p>

      {state === "ready" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleInstall()}
          className="mt-4 flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-[14.5px] font-medium text-white transition-colors duration-200 ease-quiet hover:bg-[#2e2f2b] disabled:pointer-events-none disabled:opacity-60"
        >
          Install to this device
        </button>
      )}
      {state === "installed" && (
        <p className="mt-3 text-[13px] leading-[1.55] text-ink-soft">
          Already installed on this device — open it from the home screen.
        </p>
      )}
      {state === "unavailable" &&
        (isIos() ? (
          <p className="mt-3 text-[13px] leading-[1.55] text-ink-soft">
            On iPhone or iPad: open this site in Safari, tap <strong>Share</strong>, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="mt-3 text-[13px] leading-[1.55] text-ink-soft">
            This browser is not offering an install right now. It may already be installed, or
            look for &ldquo;Install app&rdquo; / &ldquo;Add to Home screen&rdquo; in the
            browser&rsquo;s menu.
          </p>
        ))}
    </section>
  )
}
