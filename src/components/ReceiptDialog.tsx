import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MagnifyingGlassPlusIcon, ReceiptIcon, XIcon } from "@phosphor-icons/react"
import { ImageLightbox } from "./ImageLightbox"
import { peso, rowDate, shortDate } from "../lib/format"
import { fromDayKey } from "../lib/dateRange"
import { useSheetEnter } from "../lib/motion"
import type { DayAudit } from "../lib/api"
import { StatusChip } from "./AuditRow"

export type ReceiptTarget = {
  date: Date
  branchName: string
  audit: DayAudit
  /* Present when opened from a grouped batch row: every visible day the
     deposit covers, so the dialog can lay them out one by one */
  days?: DayAudit[]
}

/*
 * The deposit slip behind one audited day. The photo comes from the covering
 * deposit's stored slip; a day with none yet says so plainly rather than
 * showing a stand-in image that could be mistaken for a real slip.
 */
export function ReceiptDialog({
  target,
  onClose,
}: {
  target: ReceiptTarget | null
  onClose: () => void
}) {
  const backdropRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [zoomed, setZoomed] = useState(false)

  useSheetEnter(panelRef, backdropRef, target)

  // A fresh slip starts at the card view, not wherever the last one was left
  useEffect(() => {
    setZoomed(false)
  }, [target])

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => {
      // Escape peels one layer: the full-screen photo first, then the dialog
      if (e.key === "Escape") {
        if (zoomed) setZoomed(false)
        else onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [target, onClose, zoomed])

  if (!target) return null

  const { date, branchName, audit } = target
  /* Opened from a batch row: the member days, oldest first, for the breakdown */
  const breakdown =
    target.days && target.days.length > 1
      ? [...target.days].sort((a, b) => (a.day < b.day ? -1 : 1))
      : null
  const online = audit.online ?? 0
  /* One deposit can cover a run of days: this dialog opens on ONE of them,
     but the deposit can only be judged against the whole batch it answered.
     Comparing a six-day deposit to a single day's expected is how ₱25,813
     against ₱6,664 once read as "over by ₱19,149". */
  const covers = audit.depositCovers ?? []
  const multi = covers.length > 1
  /* A multi-day deposit recorded before the judged sum was stored has no
     honest figure to compare against — better no verdict than a wrong one */
  const judgedAgainst = audit.depositExpected ?? (multi ? null : audit.expected)
  /* Centavos — float dust must not invent an "over by ₱0" row. Cash and
     online answer the judged figure together, the way the match was judged. */
  const differenceCents =
    judgedAgainst === null
      ? 0
      : Math.round((audit.deposited ?? 0) * 100) +
        Math.round(online * 100) -
        Math.round(judgedAgainst * 100)

  const rows: { label: string; value: string; tone?: "bad" }[] = [
    { label: "Branch", value: branchName },
    /* From a batch row there is no single day in focus — the covers line and
       the breakdown below carry the dates instead */
    ...(breakdown ? [] : [{ label: "Audited day", value: rowDate(date) }]),
    { label: "Reference no.", value: audit.reference ?? "None yet" },
    ...(multi
      ? [
          {
            label: "One deposit covers",
            value: `${covers.length} days · ${shortDate(fromDayKey(covers[0]))} – ${shortDate(
              fromDayKey(covers[covers.length - 1]),
            )}`,
          },
        ]
      : []),
    ...(!breakdown && audit.advances > 0
      ? [{ label: "Cash advances (deducted)", value: peso.format(audit.advances) }]
      : []),
    ...(breakdown
      ? []
      : [
          {
            label: multi ? "This day's expected" : "Expected deposit",
            value: peso.format(audit.expected),
          },
        ]),
    ...(multi && judgedAgainst !== null
      ? [{ label: "Expected for all covered days", value: peso.format(judgedAgainst) }]
      : []),
    { label: "Amount deposited", value: peso.format(audit.deposited ?? 0) },
    ...(online > 0 ? [{ label: "GCash / online", value: peso.format(online) }] : []),
  ]
  if (differenceCents !== 0) {
    rows.push({
      label: differenceCents > 0 ? "Over by" : "Short by",
      value: peso.format(Math.abs(differenceCents) / 100),
      tone: "bad",
    })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deposit slip"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
    >
      <button
        ref={backdropRef}
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/25"
      />

      <div
        ref={panelRef}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-line bg-surface pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-xl sm:border sm:pb-0 sm:shadow-[0_8px_28px_rgba(21,22,19,0.14)]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Deposit slip</h2>
            <p className="mt-0.5 text-[13px] text-mute">
              {breakdown ? "Evidence for the covered days." : "Evidence for this audited day."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={audit.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
            >
              <XIcon size={16} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-4">
          {audit.slipUrl ? (
            /* The preview is card-sized; reading the dot-matrix line takes
               the full screen, one tap away */
            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label="Open the slip photo full screen"
              className="relative block w-full cursor-zoom-in"
            >
              <img
                src={audit.slipUrl}
                alt={`Deposit slip for ${rowDate(date)}, ${branchName}`}
                className="max-h-[50dvh] w-full rounded-lg border border-line bg-canvas object-contain"
              />
              <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                <MagnifyingGlassPlusIcon size={12} weight="bold" aria-hidden="true" />
                Tap to zoom
              </span>
            </button>
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-canvas">
              <ReceiptIcon size={26} className="text-mute" aria-hidden="true" />
              <p className="max-w-[16rem] text-center text-[12.5px] leading-relaxed text-mute">
                No slip photo is on file for this day yet.
              </p>
            </div>
          )}
        </div>

        <dl className="mt-4 divide-y divide-line border-t border-line">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
              <dt className="text-[13px] text-mute">{r.label}</dt>
              <dd
                className={`text-[13.5px] font-medium tabular-nums ${
                  r.tone === "bad" ? "text-claret" : "text-ink"
                }`}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* The full data behind a batch: which days this one slip answers
            for, each with its own expected figure */}
        {breakdown && (
          <div className="border-t border-line px-5 py-3">
            <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-mute">
              The covered days
            </p>
            <dl className="mt-1.5 space-y-1">
              {breakdown.map((d) => (
                <div key={d.day} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-mute">{rowDate(fromDayKey(d.day))}</dt>
                  <dd className="text-[13.5px] font-medium tabular-nums text-ink">
                    {peso.format(d.expected)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[12px] leading-[1.5] text-mute">
              Expected per day; the deposit answers their sum.
            </p>
          </div>
        )}
      </div>

      {zoomed && audit.slipUrl && (
        <ImageLightbox
          src={audit.slipUrl}
          alt={`Deposit slip for ${rowDate(date)}, ${branchName}`}
          onClose={() => setZoomed(false)}
        />
      )}
    </div>,
    document.body,
  )
}
