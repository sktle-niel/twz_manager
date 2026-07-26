import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ReceiptIcon, XIcon } from "@phosphor-icons/react"
import { peso, rowDate } from "../lib/format"
import type { DayAudit } from "../lib/mock"
import { StatusChip } from "./AuditRow"

export type ReceiptTarget = { date: Date; branchName: string; audit: DayAudit }

/*
 * The deposit slip behind one audited day. The photo itself only exists once
 * uploads are stored server-side, so the frame says so plainly rather than
 * showing a stand-in image that could be mistaken for a real slip.
 */
export function ReceiptDialog({
  target,
  onClose,
}: {
  target: ReceiptTarget | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [target, onClose])

  if (!target) return null

  const { date, branchName, audit } = target
  const difference = (audit.deposited ?? 0) - audit.expected

  const rows: { label: string; value: string; tone?: "bad" }[] = [
    { label: "Branch", value: branchName },
    { label: "Audited day", value: rowDate(date) },
    { label: "Reference no.", value: audit.reference ?? "—" },
    { label: "Expected deposit", value: peso.format(audit.expected) },
    { label: "Amount deposited", value: peso.format(audit.deposited ?? 0) },
  ]
  if (difference !== 0) {
    rows.push({
      label: difference > 0 ? "Over by" : "Short by",
      value: peso.format(Math.abs(difference)),
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
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="anim-fade absolute inset-0 cursor-default bg-ink/25"
      />

      <div className="anim-sheet relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-line bg-surface pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-xl sm:border sm:pb-0 sm:shadow-[0_8px_28px_rgba(21,22,19,0.14)]">
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Deposit slip</h2>
            <p className="mt-0.5 text-[13px] text-mute">Evidence for this audited day.</p>
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
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-canvas">
            <ReceiptIcon size={26} className="text-mute" aria-hidden="true" />
            <p className="max-w-[16rem] text-center text-[12.5px] leading-relaxed text-mute">
              The deposit slip photo appears here once uploads are stored by the backend.
            </p>
          </div>
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
      </div>
    </div>,
    document.body,
  )
}
