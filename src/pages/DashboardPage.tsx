import { useEffect, useState } from "react"
import { hourLabel, peso, rowDate, shortDate } from "../lib/format"
import { BranchTag } from "../components/ui"
import { DateRangePicker } from "../components/DateRangePicker"
import { SalesChart } from "../components/SalesChart"
import type { SalesPoint } from "../components/SalesChart"
import { StatCard } from "../components/StatCard"
import type { Stat } from "../components/StatCard"
import { Pagination } from "../components/Pagination"
import { dayKey, expensesFor, grossSalesFor, visibleHourlySales } from "../lib/mock"
import { useSession } from "../lib/session"
import { addDays, presetRange, rangeDays, rangeLabel, sameDay, startOfDay } from "../lib/dateRange"
import type { DateRange } from "../lib/dateRange"

const rowGrid =
  "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr] sm:items-baseline"

const PAGE_SIZE = 20

export default function DashboardPage() {
  const { store } = useSession()
  const [range, setRange] = useState<DateRange>(() => presetRange("today", startOfDay(new Date())))
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [store.id, range])

  const today = startOfDay(new Date())
  const days = rangeDays(range, today)

  const storeIds = [store.id]
  const singleDay = days.length === 1

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

  const storeLabel = store.name
  const label = rangeLabel(range, today)

  const listDays: Date[] = singleDay
    ? Array.from({ length: 7 }, (_, i) => addDays(range.start, -(i + 1)))
    : [...days].reverse()
  const listTitle = singleDay ? "Previous days" : "Daily summary"

  const listTotalPages = Math.max(1, Math.ceil(listDays.length / PAGE_SIZE))
  const listPage = Math.min(page, listTotalPages)
  const pageDays = listDays.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE)

  const best = chartData.reduce(
    (top, p) => (p.amount > top.amount ? p : top),
    chartData[0] ?? { label: "", amount: 0 },
  )
  const average = chartData.length ? Math.round(grossTotal / chartData.length) : 0
  const expensesShare = grossTotal > 0 ? Math.round((expensesTotal / grossTotal) * 100) : 0
  const rangeStats: Stat[] = [
    { label: singleDay ? "Hours recorded" : "Days recorded", value: String(chartData.length) },
    { label: singleDay ? "Average per hour" : "Average per day", value: peso.format(average) },
    {
      label: singleDay ? "Busiest hour" : "Best day",
      value: peso.format(best.amount),
      hint: best.label,
    },
    { label: "Expenses share", value: `${expensesShare}%`, hint: "of gross sales" },
  ]

  return (
    <>
      <h1
        className="mt-6 text-[22px] font-semibold tracking-[-0.01em] text-ink"
        data-rise
      >
        Dashboard
      </h1>

      {/* Filters */}
      <div
        className="mt-4 flex flex-wrap items-center gap-2.5"
        data-rise
      >
        <BranchTag name={store.name} />

        <DateRangePicker value={range} onChange={setRange} today={today} />
      </div>

      {/* Gross sales for the selected range */}
      <section
        className="mt-5 rounded-xl border border-line bg-surface p-5"
        data-rise
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
                  {label} · {storeLabel}
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
              <SalesChart data={chartData} ariaLabel={`Gross sales chart, ${label}, ${storeLabel}`} />
            )}
          </>
        )}
      </section>

      {/* Per-day summary, paired with the range stats on wide screens */}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section
          className="rounded-xl border border-line bg-surface"
          data-rise
        >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">{listTitle}</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            Gross sales, expenses, and the expected bank deposit per day.
          </p>
        </div>

        <div className="mt-2 hidden gap-x-4 border-b border-line px-5 py-2.5 sm:grid sm:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <span className="text-[12px] font-medium text-mute">Date</span>
          <span className="text-right text-[12px] font-medium text-mute">Gross sales</span>
          <span className="text-right text-[12px] font-medium text-mute">Expenses</span>
          <span className="text-right text-[12px] font-medium text-mute">Expected deposit</span>
        </div>

        {listDays.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-mute">
            No days in this range yet.
          </p>
        ) : (
          <>
          <ul className="divide-y divide-line">
            {pageDays.map((d) => {
              const gross = storeIds.reduce((s, id) => s + grossSalesFor(id, d), 0)
              const spent = storeIds.reduce((s, id) => s + expensesFor(id, d), 0)
              return (
                <li key={dayKey(d)} className={rowGrid}>
                  <span className="text-[13.5px] font-medium text-ink-soft">
                    {sameDay(d, today) ? `Today, ${shortDate(d)}` : rowDate(d)}
                  </span>
                  <span className="text-right text-[14px] font-semibold tabular-nums text-ink">
                    {peso.format(gross)}
                  </span>
                  <span className="text-[12px] tabular-nums text-mute sm:text-right sm:text-[13px]">
                    <span className="sm:hidden">Expenses </span>
                    {peso.format(spent)}
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-mute sm:text-[13px]">
                    <span className="sm:hidden">Expected </span>
                    {peso.format(gross - spent)}
                  </span>
                </li>
              )
            })}
          </ul>
          <Pagination
            page={listPage}
            pageSize={PAGE_SIZE}
            total={listDays.length}
            onPageChange={setPage}
            unit="days"
          />
          </>
        )}
        </section>

        {days.length > 0 && (
          <StatCard title="Range at a glance" stats={rangeStats} />
        )}
      </div>
    </>
  )
}
