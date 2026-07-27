import { useEffect, useState } from "react"
import { CalendarBlankIcon, FunnelIcon, StorefrontIcon } from "@phosphor-icons/react"
import { peso } from "../lib/format"
import { STORES, dayAuditFor, dayKey } from "../lib/mock"
import type { DayAudit, DayStatus, Store } from "../lib/mock"
import { FilterSelect } from "../components/ui"
import { StatCard } from "../components/StatCard"
import type { Stat } from "../components/StatCard"
import { Pagination } from "../components/Pagination"
import { AUDIT_COLS, AUDIT_COLS_BRANCH, AuditHeader, AuditRow } from "../components/AuditRow"
import { ReceiptDialog } from "../components/ReceiptDialog"
import type { ReceiptTarget } from "../components/ReceiptDialog"
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

export default function AdminHistoryPage() {
  const [storeId, setStoreId] = useState("all")
  const [preset, setPreset] = useState<RangePreset>("last30")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const [receipt, setReceipt] = useState<ReceiptTarget | null>(null)

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
  const cols = allBranches ? AUDIT_COLS_BRANCH : AUDIT_COLS

  const summaryStats: Stat[] = [
    { label: "Matched", value: String(counts.matched) },
    { label: "Discrepancy", value: String(counts.discrepancy) },
    { label: "Pending deposit", value: String(counts.pending) },
    { label: "Open", value: String(counts.open) },
    { label: "Total expected", value: peso.format(expectedTotal) },
  ]

  return (
    <>
      <div className="mt-6" data-rise>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">History</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Every audited day across the branches and how its deposit reconciled.
        </p>
      </div>

      {/* Filters */}
      <div
        className="mt-4 flex flex-wrap items-center gap-2.5"
        data-rise
      >
        <FilterSelect
          ariaLabel="Branch"
          icon={<StorefrontIcon size={15} weight="bold" aria-hidden="true" />}
          value={storeId}
          onChange={setStoreId}
          options={[
            { value: "all", label: "All branches" },
            ...STORES.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />

        <FilterSelect
          ariaLabel="Date range"
          icon={<CalendarBlankIcon size={15} weight="bold" aria-hidden="true" />}
          value={preset}
          onChange={(v) => setPreset(v as RangePreset)}
          options={RANGES}
        />

        <FilterSelect
          ariaLabel="Status"
          icon={<FunnelIcon size={15} weight="bold" aria-hidden="true" />}
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={STATUS_OPTIONS}
        />
      </div>

      {/* Reconciliation table, paired with the summary rail on wide screens */}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[2fr_1fr]">
        <section
          className="rounded-xl border border-line bg-surface"
          data-rise
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

        <AuditHeader cols={cols} withBranch={allBranches} />

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-mute">
            No days match these filters.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {pageRows.map(({ key, date, store, audit }) => (
                <AuditRow
                  key={key}
                  date={date}
                  branchName={allBranches ? store.name : undefined}
                  audit={audit}
                  cols={cols}
                  onViewReceipt={() => setReceipt({ date, branchName: store.name, audit })}
                />
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

        <StatCard title="In this range" subtitle={scopeLabel} stats={summaryStats} />
      </div>

      <ReceiptDialog target={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
