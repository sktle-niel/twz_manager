import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  FunnelIcon,
  StorefrontIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { peso, rowDate, shortDate } from "../lib/format"
import { STORES, dayAuditFor, dayKey } from "../lib/mock"
import type { DayAudit, DayStatus, Store } from "../lib/mock"
import { FilterSelect } from "../components/ui"
import { StatCard } from "../components/StatCard"
import type { Stat } from "../components/StatCard"
import { Pagination } from "../components/Pagination"
import { addDays, startOfDay } from "../lib/dateRange"

type RangePreset = "last7" | "last30" | "last90" | "thisMonth" | "lastMonth" | "thisYear"
type StatusFilter = "all" | DayStatus

const RANGES: { value: RangePreset; label: string }[] = [
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
]

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "matched", label: "Matched" },
  { value: "discrepancy", label: "Discrepancy" },
  { value: "pending", label: "Pending deposit" },
  { value: "open", label: "Open" },
]

const PAGE_SIZE = 20
/* Safety bound: a year across every branch is a little over a thousand rows */
const MAX_ROWS = 2000

function StatusChip({ status }: { status: DayStatus }) {
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

export default function AdminHistoryPage() {
  const [storeId, setStoreId] = useState("all")
  const [preset, setPreset] = useState<RangePreset>("last30")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [storeId, preset, status])

  const today = startOfDay(new Date())

  let start: Date
  let end: Date
  switch (preset) {
    case "last7":
      start = addDays(today, -6)
      end = today
      break
    case "last30":
      start = addDays(today, -29)
      end = today
      break
    case "last90":
      start = addDays(today, -89)
      end = today
      break
    case "thisMonth":
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = today
      break
    case "lastMonth":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case "thisYear":
      start = new Date(today.getFullYear(), 0, 1)
      end = today
      break
  }

  const allBranches = storeId === "all"
  const scopeStores = allBranches ? STORES : STORES.filter((s) => s.id === storeId)

  const allRows: { key: string; date: Date; store: Store; audit: DayAudit }[] = []
  for (let d = end; d >= start && allRows.length < MAX_ROWS; d = addDays(d, -1)) {
    for (const store of scopeStores) {
      allRows.push({
        key: `${store.id}:${dayKey(d)}`,
        date: d,
        store,
        audit: dayAuditFor(store.id, d),
      })
      if (allRows.length >= MAX_ROWS) break
    }
  }
  const rows = allRows.filter((r) => status === "all" || r.audit.status === status)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Counted across the whole range, so the summary holds while filtering
  const counts = { matched: 0, discrepancy: 0, pending: 0, open: 0 }
  for (const r of allRows) counts[r.audit.status]++
  const expectedTotal = allRows.reduce((sum, r) => sum + r.audit.expected, 0)

  const scopeLabel = allBranches ? "All branches" : STORES.find((s) => s.id === storeId)?.name ?? ""

  const summaryStats: Stat[] = [
    { label: "Matched", value: String(counts.matched) },
    { label: "Discrepancy", value: String(counts.discrepancy) },
    { label: "Pending deposit", value: String(counts.pending) },
    { label: "Open", value: String(counts.open) },
    { label: "Total expected", value: peso.format(expectedTotal) },
  ]

  return (
    <>
      <div className="anim-rise mt-6" style={{ "--index": 0 } as CSSProperties}>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">History</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Every audited day across the branches and how its deposit reconciled.
        </p>
      </div>

      {/* Filters */}
      <div
        className="anim-rise mt-4 flex flex-wrap items-center gap-2.5"
        style={{ "--index": 1 } as CSSProperties}
      >
        <FilterSelect
          ariaLabel="Branch"
          icon={<StorefrontIcon size={15} weight="bold" aria-hidden="true" />}
          value={storeId}
          onChange={setStoreId}
        >
          <option value="all">All branches</option>
          {STORES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          ariaLabel="Date range"
          icon={<CalendarBlankIcon size={15} weight="bold" aria-hidden="true" />}
          value={preset}
          onChange={(v) => setPreset(v as RangePreset)}
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          ariaLabel="Status"
          icon={<FunnelIcon size={15} weight="bold" aria-hidden="true" />}
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterSelect>
      </div>

      {/* Reconciliation list, paired with the summary on wide screens */}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.7fr_1fr]">
        <section
          className="anim-rise rounded-xl border border-line bg-surface"
          style={{ "--index": 2 } as CSSProperties}
        >
        <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{scopeLabel}</h2>
            <p className="mt-0.5 text-[13px] text-mute">
              Expected deposit is gross sales minus logged expenses for the day.
            </p>
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-mute">
            {rows.length.toLocaleString()} {rows.length === 1 ? "record" : "records"}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-mute">
            No days match these filters.
          </p>
        ) : (
          <>
          <ul className="mt-1 divide-y divide-line">
            {pageRows.map(({ key, date, store, audit }) => (
              <li key={key} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[13.5px] font-medium text-ink-soft">
                      {audit.status === "open" ? `Today, ${shortDate(date)}` : rowDate(date)}
                    </span>
                    {allBranches && <span className="text-[12px] text-mute">· {store.name}</span>}
                  </span>
                  <span className="mt-0.5 block text-[12px] tabular-nums text-mute">
                    Gross {peso.format(audit.gross)} ·{" "}
                    {audit.deposited === null
                      ? audit.status === "open"
                        ? "still open"
                        : "not yet deposited"
                      : `deposited ${peso.format(audit.deposited)}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[14px] font-semibold tabular-nums text-ink">
                    {peso.format(audit.expected)}
                  </span>
                  <StatusChip status={audit.status} />
                </span>
              </li>
            ))}
          </ul>
          <Pagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={rows.length}
            onPageChange={setPage}
            unit="records"
          />
          </>
        )}
        </section>

        <StatCard title="In this range" subtitle={scopeLabel} stats={summaryStats} index={3} />
      </div>
    </>
  )
}
