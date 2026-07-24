import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { StorefrontIcon } from "@phosphor-icons/react"
import { hourLabel, peso, rowDate, shortDate } from "../lib/format"
import { FilterSelect } from "../components/ui"
import { DateRangePicker } from "../components/DateRangePicker"
import { SalesChart } from "../components/SalesChart"
import type { SalesPoint } from "../components/SalesChart"
import { StatCard } from "../components/StatCard"
import type { Stat } from "../components/StatCard"
import { Pagination } from "../components/Pagination"
import { STORES, dayKey, expensesFor, grossSalesFor, visibleHourlySales } from "../lib/mock"
import { presetRange, rangeDays, rangeLabel, sameDay, startOfDay } from "../lib/dateRange"
import type { DateRange } from "../lib/dateRange"

const rowGrid =
  "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr] sm:items-baseline"

const PAGE_SIZE = 20

export default function AdminOverviewPage() {
  const [storeId, setStoreId] = useState("all")
  const [range, setRange] = useState<DateRange>(() => presetRange("today", startOfDay(new Date())))
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [storeId, range])

  const today = startOfDay(new Date())
  const days = rangeDays(range, today)

  const allBranches = storeId === "all"
  const storeIds = allBranches ? STORES.map((s) => s.id) : [storeId]
  const singleDay = days.length === 1
  const scopeLabel = allBranches ? "All branches" : STORES.find((s) => s.id === storeId)?.name ?? ""

  let chartData: SalesPoint[] = []
  if (singleDay) {
    const perStore = storeIds.map((id) => visibleHourlySales(id, days[0]))
    const len = perStore[0]?.length ?? 0
    chartData = Array.from({ length: len }, (_, i) => ({
      label: hourLabel(perStore[0][i].hour),
      amount: perStore.reduce((sum, list) => sum + list[i].amount, 0),
    }))
  } else {
    chartData = days.map((d) => ({
      label: shortDate(d),
      amount: storeIds.reduce((sum, id) => sum + grossSalesFor(id, d), 0),
    }))
  }

  const grossTotal = days.reduce(
    (sum, d) => sum + storeIds.reduce((s, id) => s + grossSalesFor(id, d), 0),
    0,
  )
  const expensesTotal = days.reduce(
    (sum, d) => sum + storeIds.reduce((s, id) => s + expensesFor(id, d), 0),
    0,
  )
  const expectedTotal = grossTotal - expensesTotal

  const label = rangeLabel(range, today)

  // All branches -> one row per branch; a single branch -> one row per day
  const tableRows = allBranches
    ? STORES.map((s) => ({
        key: s.id,
        label: s.name,
        gross: days.reduce((sum, d) => sum + grossSalesFor(s.id, d), 0),
        expenses: days.reduce((sum, d) => sum + expensesFor(s.id, d), 0),
      }))
    : [...days].reverse().map((d) => ({
        key: dayKey(d),
        label: sameDay(d, today) ? `Today, ${shortDate(d)}` : rowDate(d),
        gross: grossSalesFor(storeId, d),
        expenses: expensesFor(storeId, d),
      }))

  const tableTotalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE))
  const tablePage = Math.min(page, tableTotalPages)
  const pageTableRows = tableRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE)

  const firstColHeader = allBranches ? "Branch" : "Date"
  const tableTitle = allBranches ? "By branch" : `${scopeLabel} branch`
  const tableSubtitle = allBranches
    ? "Gross sales, expenses, and expected deposit per branch."
    : "Gross sales, expenses, and expected deposit per day."

  const best = chartData.reduce(
    (top, p) => (p.amount > top.amount ? p : top),
    chartData[0] ?? { label: "", amount: 0 },
  )
  const average = chartData.length ? Math.round(grossTotal / chartData.length) : 0
  const expensesShare = grossTotal > 0 ? Math.round((expensesTotal / grossTotal) * 100) : 0
  const topBranch =
    allBranches && tableRows.length > 0
      ? tableRows.reduce((top, r) => (r.gross > top.gross ? r : top), tableRows[0])
      : null
  const rangeStats: Stat[] = [
    { label: singleDay ? "Hours recorded" : "Days recorded", value: String(chartData.length) },
    { label: singleDay ? "Average per hour" : "Average per day", value: peso.format(average) },
    {
      label: singleDay ? "Busiest hour" : "Best day",
      value: peso.format(best.amount),
      hint: best.label,
    },
    ...(topBranch
      ? [{ label: "Top branch", value: peso.format(topBranch.gross), hint: topBranch.label }]
      : []),
    { label: "Expenses share", value: `${expensesShare}%`, hint: "of gross sales" },
  ]

  return (
    <>
      <div className="anim-rise mt-6" style={{ "--index": 0 } as CSSProperties}>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Overview</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Sales, expenses, and expected deposits across every branch.
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

        <DateRangePicker value={range} onChange={setRange} today={today} />
      </div>

      {/* Gross sales for the selected range */}
      <section
        className="anim-rise mt-5 rounded-xl border border-line bg-surface p-5"
        style={{ "--index": 2 } as CSSProperties}
      >
        {days.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-mute">
            No sales data for this range yet.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <h2 className="text-[13px] font-medium text-mute">Gross sales</h2>
                <p className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-ink">
                  {peso.format(grossTotal)}
                </p>
                <p className="mt-1.5 text-[13px] text-mute">
                  {label} · {scopeLabel}
                </p>
              </div>
              <dl className="flex gap-6">
                <div>
                  <dt className="text-[12px] text-mute">Expenses</dt>
                  <dd className="mt-0.5 text-[15px] font-medium tabular-nums text-ink-soft">
                    {peso.format(expensesTotal)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-mute">Expected deposit</dt>
                  <dd className="mt-0.5 text-[15px] font-medium tabular-nums text-ink-soft">
                    {peso.format(expectedTotal)}
                  </dd>
                </div>
              </dl>
            </div>

            {chartData.length === 0 ? (
              <p className="py-14 text-center text-[14px] text-mute">
                No sales recorded yet today. The chart fills in as the day goes.
              </p>
            ) : (
              <SalesChart data={chartData} ariaLabel={`Gross sales chart, ${label}, ${scopeLabel}`} />
            )}
          </>
        )}
      </section>

      {/* Combined table, paired with the range stats on wide screens */}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section
          className="anim-rise rounded-xl border border-line bg-surface"
          style={{ "--index": 3 } as CSSProperties}
        >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">{tableTitle}</h2>
          <p className="mt-0.5 text-[13px] text-mute">{tableSubtitle}</p>
        </div>

        <div className="mt-2 hidden gap-x-4 border-b border-line px-5 py-2.5 sm:grid sm:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <span className="text-[12px] font-medium text-mute">{firstColHeader}</span>
          <span className="text-right text-[12px] font-medium text-mute">Gross sales</span>
          <span className="text-right text-[12px] font-medium text-mute">Expenses</span>
          <span className="text-right text-[12px] font-medium text-mute">Expected deposit</span>
        </div>

        {days.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-mute">No days in this range yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {pageTableRows.map((r) => (
                <li key={r.key} className={rowGrid}>
                  <span className="text-[13.5px] font-medium text-ink-soft">{r.label}</span>
                  <span className="text-right text-[14px] font-semibold tabular-nums text-ink">
                    {peso.format(r.gross)}
                  </span>
                  <span className="text-[12px] tabular-nums text-mute sm:text-right sm:text-[13px]">
                    <span className="sm:hidden">Expenses </span>
                    {peso.format(r.expenses)}
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-mute sm:text-[13px]">
                    <span className="sm:hidden">Expected </span>
                    {peso.format(r.gross - r.expenses)}
                  </span>
                </li>
              ))}
            </ul>

            <div className={`${rowGrid} border-t border-line`}>
              <span className="text-[13.5px] font-semibold text-ink">Total</span>
              <span className="text-right text-[14px] font-semibold tabular-nums text-ink">
                {peso.format(grossTotal)}
              </span>
              <span className="text-[12px] font-medium tabular-nums text-ink-soft sm:text-right sm:text-[13px]">
                <span className="sm:hidden">Expenses </span>
                {peso.format(expensesTotal)}
              </span>
              <span className="text-right text-[12px] font-medium tabular-nums text-ink-soft sm:text-[13px]">
                <span className="sm:hidden">Expected </span>
                {peso.format(expectedTotal)}
              </span>
            </div>

            <Pagination
              page={tablePage}
              pageSize={PAGE_SIZE}
              total={tableRows.length}
              onPageChange={setPage}
              unit={allBranches ? "branches" : "days"}
            />
          </>
        )}
        </section>

        {days.length > 0 && (
          <StatCard title="Range at a glance" stats={rangeStats} index={4} />
        )}
      </div>
    </>
  )
}
