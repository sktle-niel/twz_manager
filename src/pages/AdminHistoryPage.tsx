import { useEffect, useState } from "react"
import { CalendarBlankIcon, FunnelIcon, StorefrontIcon } from "@phosphor-icons/react"
import { peso } from "../lib/format"
import { api } from "../lib/api"
import type { Store } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useOwnerSession } from "../lib/session"
import { FilterSelect, SegmentedTabs } from "../components/ui"
import { Loading } from "../components/Loading"
import { StatCard } from "../components/StatCard"
import type { Stat } from "../components/StatCard"
import { Pagination } from "../components/Pagination"
import { AUDIT_COLS, AUDIT_COLS_BRANCH, AuditEntry, AuditHeader } from "../components/AuditRow"
import { ReceiptDialog } from "../components/ReceiptDialog"
import type { ReceiptTarget } from "../components/ReceiptDialog"
import { groupByDeposit, receiptTargetFor } from "../lib/historyGroups"
import {
  HISTORY_RANGES,
  HISTORY_STATUS_OPTIONS,
  HISTORY_TABS,
  filterEntries,
  countEntries,
  presetBounds,
} from "../lib/historyFilters"
import type { HistoryTab, RangePreset, StatusFilter } from "../lib/historyFilters"
import { dayKey, startOfDay } from "../lib/dateRange"

const PAGE_SIZE = 20
/* Safety bound: a year across every branch is a little over a thousand rows */
const MAX_ROWS = 2000

export default function AdminHistoryPage() {
  const { stores } = useOwnerSession()
  const [storeId, setStoreId] = useState("all")
  const [preset, setPreset] = useState<RangePreset>("last30")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [tab, setTab] = useState<HistoryTab>("all")
  const [page, setPage] = useState(1)
  const [receipt, setReceipt] = useState<ReceiptTarget | null>(null)

  useEffect(() => {
    setPage(1)
  }, [storeId, preset, status, tab])

  const today = startOfDay(new Date())
  const { start, end } = presetBounds(preset, today)

  const allBranches = storeId === "all"
  const scopeStores = allBranches ? stores : stores.filter((s) => s.id === storeId)
  const scopeIds = scopeStores.map((s) => s.id).join(",")

  const from = dayKey(start)
  const to = dayKey(end)
  /* One request covering every branch in scope, rather than a call per branch
     per day; MAX_ROWS then bounds what this view will draw */
  const audits = useApi(
    () => api.dayAudits(scopeIds ? scopeIds.split(",") : [], { from, to }),
    [scopeIds, from, to],
  )

  const byStore = new Map<string, Store>(stores.map((s) => [s.id, s]))
  const allAudits = [...(audits.data ?? [])]
    .sort((a, b) => (a.day === b.day ? a.storeId.localeCompare(b.storeId) : a.day < b.day ? 1 : -1))
    .slice(0, MAX_ROWS)
    .filter((audit) => byStore.has(audit.storeId))
  /* Days one deposit covers fold into a single line — five rows repeating
     the same slip figure read as five deposits */
  const entries = groupByDeposit(allAudits)
  const rows = filterEntries(entries, tab, status)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  /* Counted across the whole range, so the summary holds while filtering.
     A batch deposit counts once — the summary answers "how many deposits
     reconciled", not "how many days they happened to span". */
  const counts = countEntries(entries)
  const expectedTotal = allAudits.reduce((sum, a) => sum + a.expected, 0)

  const scopeLabel = allBranches ? "All branches" : byStore.get(storeId)?.name ?? ""
  const cols = allBranches ? AUDIT_COLS_BRANCH : AUDIT_COLS

  const summaryStats: Stat[] = [
    { label: "Matched", value: String(counts.matched) },
    { label: "Over", value: String(counts.over) },
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
        <SegmentedTabs
          ariaLabel="Reconciliation state"
          value={tab}
          onChange={setTab}
          options={HISTORY_TABS}
        />

        <FilterSelect
          ariaLabel="Branch"
          icon={<StorefrontIcon size={15} weight="bold" aria-hidden="true" />}
          value={storeId}
          onChange={setStoreId}
          options={[
            { value: "all", label: "All branches" },
            ...stores.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />

        <FilterSelect
          ariaLabel="Date range"
          icon={<CalendarBlankIcon size={15} weight="bold" aria-hidden="true" />}
          value={preset}
          onChange={(v) => setPreset(v as RangePreset)}
          options={HISTORY_RANGES}
        />

        <FilterSelect
          ariaLabel="Status"
          icon={<FunnelIcon size={15} weight="bold" aria-hidden="true" />}
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={HISTORY_STATUS_OPTIONS}
        />
      </div>

      {/* Reconciliation table, paired with the summary rail on wide screens */}
      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          className="rounded-xl border border-line bg-surface"
          data-rise
        >
        <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{scopeLabel}</h2>
            <p className="mt-0.5 text-[13px] text-mute">
              Expected deposit is net sales minus logged expenses for the day.
            </p>
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-mute">
            {rows.length.toLocaleString()} {rows.length === 1 ? "record" : "records"}
          </span>
        </div>

        <AuditHeader cols={cols} withBranch={allBranches} />

        {audits.error ? (
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
        ) : audits.loading && rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px]">
            <Loading />
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-mute">
            No days match these filters.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {pageRows.map((entry) => {
                const name = byStore.get(entry.audits[0].storeId)?.name ?? ""
                return (
                  <AuditEntry
                    key={entry.key}
                    entry={entry}
                    branchName={allBranches ? name : undefined}
                    cols={cols}
                    onViewReceipt={() => setReceipt(receiptTargetFor(entry, name))}
                  />
                )
              })}
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
