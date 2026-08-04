import { useEffect, useState } from "react"
import { StorefrontIcon } from "@phosphor-icons/react"
import { hourLabel, peso, rowDate, shortDate } from "../lib/format"
import { FilterSelect } from "../components/ui"
import { DateRangePicker } from "../components/DateRangePicker"
import { SalesChart } from "../components/SalesChart"
import type { SalesPoint } from "../components/SalesChart"
import { BranchSalesCard } from "../components/BranchSalesCard"
import { Pagination } from "../components/Pagination"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useOwnerSession } from "../lib/session"
import { dayKey, presetRange, rangeDays, rangeLabel, sameDay, startOfDay } from "../lib/dateRange"
import type { DateRange } from "../lib/dateRange"

const rowGrid =
  "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr] sm:items-baseline"

const PAGE_SIZE = 20

export default function AdminOverviewPage() {
  const { stores } = useOwnerSession()
  const [storeId, setStoreId] = useState("all")
  const [range, setRange] = useState<DateRange>(() => presetRange("today", startOfDay(new Date())))
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [storeId, range])

  const today = startOfDay(new Date())
  const days = rangeDays(range, today)

  const allBranches = storeId === "all"
  const storeIds = allBranches ? stores.map((s) => s.id) : [storeId]
  const singleDay = days.length === 1
  const scopeLabel = allBranches ? "All branches" : stores.find((s) => s.id === storeId)?.name ?? ""

  /* Always every branch: the rail ranks them all, and the table is a filter
     over the same rows rather than a second query */
  const from = dayKey(days[0] ?? today)
  const to = dayKey(days[days.length - 1] ?? today)
  const allIds = stores.map((s) => s.id).join(",")
  const sales = useApi(
    () => api.dailySales(allIds.split(","), { from, to }),
    [allIds, from, to],
  )
  const hourly = useApi(
    () => (singleDay ? api.hourlySales(storeIds, dayKey(days[0])) : Promise.resolve([])),
    [storeIds.join(","), singleDay, singleDay ? dayKey(days[0]) : ""],
  )

  const rows = sales.data ?? []
  const inScope = rows.filter((r) => storeIds.includes(r.storeId))
  const perDay = new Map<string, number>()
  for (const r of inScope) perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.gross)

  const chartData: SalesPoint[] = singleDay
    ? (hourly.data ?? []).map((p) => ({ label: hourLabel(p.hour), amount: p.amount }))
    : days.map((d) => ({ label: shortDate(d), amount: perDay.get(dayKey(d)) ?? 0 }))

  const grossTotal = inScope.reduce((sum, r) => sum + r.gross, 0)
  const expensesTotal = inScope.reduce((sum, r) => sum + r.expenses, 0)
  const expectedTotal = grossTotal - expensesTotal

  const label = rangeLabel(range, today)

  // All branches -> one row per branch; a single branch -> one row per day
  const tableRows = allBranches
    ? stores.map((s) => {
        const mine = rows.filter((r) => r.storeId === s.id)
        return {
          key: s.id,
          label: s.name,
          gross: mine.reduce((sum, r) => sum + r.gross, 0),
          expenses: mine.reduce((sum, r) => sum + r.expenses, 0),
        }
      })
    : [...days].reverse().map((d) => {
        const row = rows.find((r) => r.storeId === storeId && r.day === dayKey(d))
        return {
          key: dayKey(d),
          label: sameDay(d, today) ? `Today, ${shortDate(d)}` : rowDate(d),
          gross: row?.gross ?? 0,
          expenses: row?.expenses ?? 0,
        }
      })

  const tableTotalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE))
  const tablePage = Math.min(page, tableTotalPages)
  const pageTableRows = tableRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE)

  const firstColHeader = allBranches ? "Branch" : "Date"
  const tableTitle = allBranches ? "By branch" : `${scopeLabel} branch`
  const tableSubtitle = allBranches
    ? "Gross sales, expenses, and expected deposit per branch."
    : "Gross sales, expenses, and expected deposit per day."

  /*
   * The rail ranks every branch regardless of the branch filter — comparing
   * them is the whole point, so filtering to one only marks it in the list.
   */
  const branchSales = stores
    .map((s) => ({
      id: s.id,
      name: s.name,
      amount: rows.filter((r) => r.storeId === s.id).reduce((sum, r) => sum + r.gross, 0),
    }))
    .sort((a, b) => b.amount - a.amount)
  const branchSalesTotal = branchSales.reduce((sum, r) => sum + r.amount, 0)

  return (
    <>
      <div className="mt-6" data-rise>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Overview</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Sales, expenses, and expected deposits across every branch.
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
            ...stores.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />

        <DateRangePicker value={range} onChange={setRange} today={today} />
      </div>

      {/* Gross sales for the selected range */}
      <section
        className="mt-5 rounded-xl border border-line bg-surface p-5"
        data-rise
      >
        {sales.error || hourly.error ? (
          /* A failed read renders as a failure, never as ₱0.00 branches */
          <div role="alert" className="py-10 text-center">
            <p className="text-[14px] text-mute">The sales figures could not load.</p>
            <button
              type="button"
              onClick={() => {
                sales.reload()
                hourly.reload()
              }}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-line-strong px-4 text-[13.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
            >
              Try again
            </button>
          </div>
        ) : sales.loading ? (
          <p className="py-10 text-center text-[14px] text-mute" aria-busy="true">
            Loading sales…
          </p>
        ) : days.length === 0 ? (
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

      {/*
        Combined table, paired with the branch ranking on wide screens. The
        ranking leads on a phone: it answers "who earned what today" without
        paging through the table.
      */}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
        {days.length > 0 && (
          <div className="xl:order-2">
            <BranchSalesCard
              title="Sales by branch"
              subtitle={`${label} · gross sales, highest first.`}
              rows={branchSales}
              total={branchSalesTotal}
              highlightId={allBranches ? null : storeId}
            />
          </div>
        )}

        <section
          className="rounded-xl border border-line bg-surface xl:order-1"
          data-rise
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

        {sales.error ? (
          <p role="alert" className="flex flex-wrap items-center justify-center gap-2 px-5 py-10 text-center text-[13px] text-claret">
            These figures could not load.
            <button
              type="button"
              onClick={sales.reload}
              className="font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </p>
        ) : days.length === 0 ? (
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
      </div>
    </>
  )
}
