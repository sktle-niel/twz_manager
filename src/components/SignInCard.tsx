/*
 * Where this account has been opened from: device, platform, IP, and when.
 * It sits under the status card so a manager who sees "signed in on Realme 6"
 * can check the rest of the history without leaving the dashboard.
 */
import { DeviceMobileIcon, LaptopIcon } from "@phosphor-icons/react"
import { timeAgo } from "../lib/format"
import type { SignInEvent } from "../lib/mock"

export function SignInCard({ events, now }: { events: SignInEvent[]; now: Date }) {
  return (
    <section className="rounded-xl border border-line bg-surface" data-rise>
      <div className="px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">Sign-in activity</h2>
        <p className="mt-0.5 text-[13px] text-mute">
          Devices that opened this account, newest first.
        </p>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {events.map((e) => {
          const DeviceIcon = e.kind === "phone" ? DeviceMobileIcon : LaptopIcon
          return (
            <li key={e.id} className="flex gap-2.5 px-5 py-3">
              <DeviceIcon size={16} aria-hidden="true" className="mt-[3px] shrink-0 text-mute" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] font-medium text-ink">{e.device}</span>
                  {e.current && (
                    <span className="shrink-0 rounded-full bg-sage px-2 py-0.5 text-[10.5px] font-medium text-sage-ink">
                      This device
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-[1.5] text-mute">{e.platform}</p>
                <p className="text-[12.5px] leading-[1.5] text-mute">
                  <span className="font-mono text-[12px] text-ink-soft">{e.ip}</span> · {e.place}
                </p>
                <p className="mt-0.5 text-[12px] text-mute">{timeAgo(e.at, now)}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
