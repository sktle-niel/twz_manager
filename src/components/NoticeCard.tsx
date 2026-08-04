/*
 * The branch status rail: one row per thing that needs attention, in the same
 * plain label/detail shape as StatCard so it reads as part of the document.
 * Tone carries the whole signal — claret for something to fix, mute for
 * something to know, sage for something already handled.
 */
import { Link } from "react-router-dom"
import { ArrowRightIcon, CheckCircleIcon, InfoIcon, WarningCircleIcon } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import type { Notice, NoticeTone } from "../lib/notices"

const TONE: Record<NoticeTone, { icon: Icon; className: string }> = {
  alert: { icon: WarningCircleIcon, className: "text-claret" },
  info: { icon: InfoIcon, className: "text-mute" },
  ok: { icon: CheckCircleIcon, className: "text-sage-ink" },
}

function NoticeBody({ notice }: { notice: Notice }) {
  const tone = TONE[notice.tone]
  const ToneIcon = tone.icon
  return (
    <span className="flex gap-2.5 px-5 py-3">
      <ToneIcon
        size={16}
        weight="fill"
        aria-hidden="true"
        className={`mt-[3px] shrink-0 ${tone.className}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink">{notice.title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-mute">{notice.detail}</span>
        {notice.action && (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-deep">
            {notice.action}
            <ArrowRightIcon size={12} weight="bold" aria-hidden="true" />
          </span>
        )}
      </span>
    </span>
  )
}

export function NoticeCard({
  title,
  subtitle,
  notices,
  loading,
}: {
  title: string
  subtitle?: string
  notices: Notice[]
  loading?: boolean
}) {
  return (
    <section className="rounded-xl border border-line bg-surface" data-rise>
      <div className="px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-mute">{subtitle}</p>}
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {notices.length === 0 ? (
          <li className="px-5 py-6 text-center text-[13.5px] text-mute">
            {loading ? "Loading…" : "Nothing needs attention right now."}
          </li>
        ) : (
          notices.map((n) => (
            <li key={n.id}>
              {n.to ? (
                <Link
                  to={n.to}
                  className="block transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
                >
                  <NoticeBody notice={n} />
                </Link>
              ) : (
                <NoticeBody notice={n} />
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
