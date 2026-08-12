import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { peso, rowDate, shortDate } from "../lib/format"
import { fromDayKey } from "../lib/dateRange"
import type { DayAudit, DayStatus } from "../lib/api"
import type { HistoryEntry } from "../lib/historyGroups"
import { RowMenu } from "./RowMenu"

/*
 * One audited day, shared by the manager and owner History pages.
 *
 * The columnar table only turns on at xl; narrower screens get a stacked row,
 * since these columns cannot be read much below 1000px. Two rules keep the
 * grid honest:
 *
 * - Every track ends in a fixed length or a `minmax()` with a fixed minimum,
 *   never `auto`. Each row is its own grid, so an auto track would follow the
 *   width of that row's own status chip and knock the money columns out of
 *   line with the row above.
 * - The fixed minimums mean a column can never be squeezed until its text
 *   collides with the next one; text cells truncate instead. The reference
 *   number and receipt live in the row's overflow menu rather than taking
 *   columns of their own.
 * - In the branch variant, BRANCH holds the longest text, so it owns the
 *   largest share of free space — its minimum fits a full branch name at any
 *   laptop width past the xl breakpoint itself. Money cells hold short
 *   figures and give their slack up; truncating "NEW SICSICAN BRANCH" while
 *   ₱602 swims in whitespace was exactly the earlier mistake.
 */
export const AUDIT_COLS =
  "xl:grid-cols-[minmax(5rem,1.3fr)_minmax(4rem,1fr)_minmax(4rem,1fr)_minmax(4rem,1fr)_6.5rem_2.5rem]"
export const AUDIT_COLS_BRANCH =
  "xl:grid-cols-[minmax(5.25rem,0.9fr)_minmax(7.5rem,1.6fr)_minmax(3.75rem,1fr)_minmax(3.75rem,1fr)_minmax(3.75rem,1fr)_6.5rem_2rem]"

export function StatusChip({ status }: { status: DayStatus }) {
  switch (status) {
    case "matched":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink">
          <CheckCircleIcon size={12} weight="fill" aria-hidden="true" />
          Matched
        </span>
      )
    case "discrepancy":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-claret/10 px-2 py-0.5 text-[11px] font-medium text-claret">
          <WarningCircleIcon size={12} weight="fill" aria-hidden="true" />
          Discrepancy
        </span>
      )
    case "pending":
      return (
        <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-medium text-ink-soft">
          Pending deposit
        </span>
      )
    case "open":
      return (
        <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-mute">
          Open
        </span>
      )
  }
}

const headCell = "truncate text-right text-[12px] font-medium text-mute"

export function AuditHeader({ cols, withBranch }: { cols: string; withBranch: boolean }) {
  return (
    <div className={`mt-2 hidden gap-x-2 border-b border-line px-5 py-2.5 xl:grid ${cols}`}>
      <span className="truncate text-[12px] font-medium text-mute">Date</span>
      {withBranch && <span className="truncate text-[12px] font-medium text-mute">Branch</span>}
      {/* "Profit", as the stacked rows already call it — the two-word label
          was the first thing to clip when the branch column took its room */}
      <span className={headCell}>Profit</span>
      <span className={headCell}>Expected</span>
      <span className={headCell}>Deposited</span>
      <span className={headCell}>Status</span>
      <span aria-hidden="true" />
    </div>
  )
}

export function AuditRow({
  date,
  branchName,
  audit,
  cols,
  onViewReceipt,
}: {
  date: Date
  /* Only passed when the list spans every branch */
  branchName?: string
  audit: DayAudit
  cols: string
  onViewReceipt: () => void
}) {
  const dateLabel = audit.status === "open" ? `Today, ${shortDate(date)}` : rowDate(date)
  const deposited = audit.deposited
  const forRow = `${dateLabel}${branchName ? `, ${branchName}` : ""}`

  const menuItems =
    deposited === null
      ? [{ label: "No deposit yet", onSelect: () => {}, disabled: true }]
      : [{ label: "View receipt", onSelect: onViewReceipt }]

  return (
    <li className="px-5 py-3">
      {/* Stacked, below xl — a direct link reads better than a menu here */}
      <div className="xl:hidden">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="text-[13.5px] font-medium text-ink-soft">{dateLabel}</span>
              {branchName && <span className="text-[12px] text-mute">· {branchName}</span>}
            </span>
            <span className="mt-0.5 block text-[12px] tabular-nums text-mute">
              Profit {peso.format(audit.profit)}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[14px] font-semibold tabular-nums text-ink">
              {peso.format(audit.expected)}
            </span>
            <StatusChip status={audit.status} />
          </span>
        </div>
        {deposited !== null && (
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="text-[12px] tabular-nums text-mute">
              Deposited {peso.format(deposited)}
              {(audit.online ?? 0) > 0 ? ` + ${peso.format(audit.online ?? 0)} online` : ""}
              {(audit.depositCovers?.length ?? 0) > 1
                ? ` · covers ${audit.depositCovers?.length} days`
                : ""}
            </span>
            <button
              type="button"
              onClick={onViewReceipt}
              aria-label={`View receipt for ${forRow}`}
              className="text-[13px] font-medium text-brand-deep underline-offset-4 transition-opacity duration-200 ease-quiet hover:underline hover:opacity-80"
            >
              View receipt
            </button>
          </div>
        )}
      </div>

      {/* Table row, xl and up */}
      <div className={`hidden gap-x-2 xl:grid xl:items-center ${cols}`}>
        <span className="truncate text-[13.5px] font-medium text-ink-soft">{dateLabel}</span>
        {branchName !== undefined && (
          <span className="truncate text-[13px] text-mute">{branchName}</span>
        )}
        <span className="truncate text-right text-[13px] tabular-nums text-mute">
          {peso.format(audit.profit)}
        </span>
        <span className="truncate text-right text-[13.5px] font-semibold tabular-nums text-ink">
          {peso.format(audit.expected)}
        </span>
        <span className="truncate text-right text-[13px] tabular-nums text-mute">
          {deposited === null ? (
            "-"
          ) : (
            <>
              {peso.format(deposited)}
              {/* One deposit across a run of days: the figure repeats on every
                  covered row, so it must say it is the batch, not the day */}
              {(audit.depositCovers?.length ?? 0) > 1 && (
                <span className="block text-[11px] leading-tight">
                  {audit.depositCovers?.length} days
                </span>
              )}
            </>
          )}
        </span>
        <span className="justify-self-end">
          <StatusChip status={audit.status} />
        </span>
        <span className="justify-self-end">
          <RowMenu label={`Actions for ${forRow}`} items={menuItems} />
        </span>
      </div>
    </li>
  )
}

/* One History line, whichever kind the entry is: a lone day, or a batch */
export function AuditEntry({
  entry,
  branchName,
  cols,
  onViewReceipt,
}: {
  entry: HistoryEntry
  branchName?: string
  cols: string
  onViewReceipt: () => void
}) {
  const head = entry.audits[0]
  if (entry.audits.length === 1) {
    return (
      <AuditRow
        date={fromDayKey(head.day)}
        branchName={branchName}
        audit={head}
        cols={cols}
        onViewReceipt={onViewReceipt}
      />
    )
  }
  return (
    <AuditGroupRow
      audits={entry.audits}
      branchName={branchName}
      cols={cols}
      onViewReceipt={onViewReceipt}
    />
  )
}

/*
 * Every visible day one deposit covers, folded into a single line. Five rows
 * each repeating the same slip figure read as five deposits; one line saying
 * "Aug 5 – 10 · one deposit" reads as what happened. The receipt dialog
 * holds the day-by-day breakdown.
 */
export function AuditGroupRow({
  audits,
  branchName,
  cols,
  onViewReceipt,
}: {
  /* The covered days visible in this range, any order */
  audits: DayAudit[]
  branchName?: string
  cols: string
  onViewReceipt: () => void
}) {
  const sorted = [...audits].sort((a, b) => (a.day < b.day ? -1 : 1))
  const head = sorted[0]
  const first = fromDayKey(sorted[0].day)
  const last = fromDayKey(sorted[sorted.length - 1].day)
  /* "Aug 6–8" within a month — the date column is narrow, and a range that
     truncates to "Aug 6 – Au…" says nothing */
  const dateLabel =
    first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
      ? `${shortDate(first)}–${last.getDate()}`
      : `${shortDate(first)} – ${shortDate(last)}`
  /* The deposit's true span; the range may be showing only part of it */
  const span = head.depositCovers?.length ?? sorted.length
  const profit = sorted.reduce((sum, a) => sum + a.profit, 0)
  const expected = head.depositExpected ?? sorted.reduce((sum, a) => sum + a.expected, 0)
  const deposited = head.deposited ?? 0
  const online = head.online ?? 0
  const forRow = `${dateLabel}${branchName ? `, ${branchName}` : ""}`
  /* Short enough for the narrow date column — "One deposit · 3 days" clipped */
  const spanLabel = `${span}-day deposit`

  return (
    <li className="px-5 py-3">
      {/* Stacked, below xl */}
      <div className="xl:hidden">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="text-[13.5px] font-medium text-ink-soft">{dateLabel}</span>
              {branchName && <span className="text-[12px] text-mute">· {branchName}</span>}
            </span>
            <span className="mt-0.5 block text-[12px] tabular-nums text-mute">
              {spanLabel} · Profit {peso.format(profit)}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[14px] font-semibold tabular-nums text-ink">
              {peso.format(expected)}
            </span>
            <StatusChip status={head.status} />
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="text-[12px] tabular-nums text-mute">
            Deposited {peso.format(deposited)}
            {online > 0 ? ` + ${peso.format(online)} online` : ""}
          </span>
          <button
            type="button"
            onClick={onViewReceipt}
            aria-label={`View receipt for ${forRow}`}
            className="text-[13px] font-medium text-brand-deep underline-offset-4 transition-opacity duration-200 ease-quiet hover:underline hover:opacity-80"
          >
            View receipt
          </button>
        </div>
      </div>

      {/* Table row, xl and up */}
      <div className={`hidden gap-x-2 xl:grid xl:items-center ${cols}`}>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-ink-soft">{dateLabel}</span>
          <span className="block truncate text-[11px] leading-tight text-mute">{spanLabel}</span>
        </span>
        {branchName !== undefined && (
          <span className="truncate text-[13px] text-mute">{branchName}</span>
        )}
        <span className="truncate text-right text-[13px] tabular-nums text-mute">
          {peso.format(profit)}
        </span>
        <span className="truncate text-right text-[13.5px] font-semibold tabular-nums text-ink">
          {peso.format(expected)}
        </span>
        <span className="truncate text-right text-[13px] tabular-nums text-mute">
          {peso.format(deposited)}
        </span>
        <span className="justify-self-end">
          <StatusChip status={head.status} />
        </span>
        <span className="justify-self-end">
          <RowMenu
            label={`Actions for ${forRow}`}
            items={[{ label: "View receipt", onSelect: onViewReceipt }]}
          />
        </span>
      </div>
    </li>
  )
}
