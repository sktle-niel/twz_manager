import { useEffect, useState } from "react"
import { CalendarBlankIcon, FunnelIcon } from "@phosphor-icons/react"
import { peso } from "../lib/format"
import { api } from "../lib/api"
import type { DayStatus } from "../lib/api"
import { useApi } from "../lib/useApi"
import { BranchTag, FilterSelect } from "../components/ui"
import { Loading } from "../components/Loading"
import { useManagerSession } from "../lib/session"
import { StatCard } from "../components/StatCard"
import type { Stat } from "../components/StatCard"
import { Pagination } from "../components/Pagination"
import { AUDIT_COLS, AuditHeader, AuditRow } from "../components/AuditRow"
import { ReceiptDialog } from "../components/ReceiptDialog"
import type { ReceiptTarget } from "../components/ReceiptDialog"
import { addDays, dayKey, fromDayKey, startOfDay } from "../lib/dateRange"

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
/* Safety bound on how far back one view will compute */
const MAX_SCAN_DAYS = 400

export default function HistoryPage() {
  const { store } = useManagerSession()
  const storeId = store.id
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

  /* One request for the whole range; the filters below are applied to what
     came back rather than sent as another query */
  const from = dayKey(addDays(end, -(MAX_SCAN_DAYS - 1)) > start ? addDays(end, -(MAX_SCAN_DAYS - 1)) : start)
  const to = dayKey(end)
  const audits = useApi(() => api.dayAudits([storeId], { from, to }), [storeId, from, to])

  // Newest first
  const allRows = [...(audits.data ?? [])]
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .map((audit) => ({ date: fromDayKey(audit.day), audit }))
  const rows = allRows.filter((r) => status === "all" || r.audit.status === status)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Counted across the whole range, so the summary holds while filtering
  const counts = { matched: 0, discrepancy: 0, pending: 0, open: 0 }
  for (const r of allRows) counts[r.audit.status]++
  const expectedTotal = allRows.reduce((sum, r) => sum + r.audit.expected, 0)

  const storeName = store.name

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
          Every audited day and how its deposit reconciled.
        </p>
      </div>

      {/* Filters */}
      <div
        className="mt-4 flex flex-wrap items-center gap-2.5"
        data-rise
      >
        <BranchTag name={store.name} />

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

      {/* Audit table, paired with the summary rail on wide screens */}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[2fr_1fr]">
        <section
          className="rounded-xl border border-line bg-surface"
          data-rise
        >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">{storeName} branch</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            Expected deposit is gross profit minus logged expenses for the day.
          </p>
        </div>

        <AuditHeader cols={AUDIT_COLS} withBranch={false} />

        {audits.loading && rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px]">
            <Loading />
          </p>
        ) : audits.error ? (
          <p role="alert" className="flex flex-wrap items-center justify-center gap-2 px-5 py-10 text-center text-[14px] text-claret">
            {audits.error}
            <button
              type="button"
              onClick={audits.reload}
              className="font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-mute">
            No days match these filters.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {pageRows.map(({ date, audit }) => (
                <AuditRow
                  key={dayKey(date)}
                  date={date}
                  audit={audit}
                  cols={AUDIT_COLS}
                  onViewReceipt={() => setReceipt({ date, branchName: storeName, audit })}
                />
              ))}
            </ul>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={rows.length}
              onPageChange={setPage}
              unit="days"
            />
          </>
        )}
        </section>

        <StatCard
          title="In this range"
          subtitle={`${storeName} branch`}
          stats={summaryStats}
        />
      </div>

      <ReceiptDialog target={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
