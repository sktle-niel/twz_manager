import { useEffect, useState } from "react"
import { hourLabel, peso, rowDate, shortDate } from "../lib/format"
import { BranchTag } from "../components/ui"
import { DateRangePicker } from "../components/DateRangePicker"
import { SalesChart } from "../components/SalesChart"
import type { SalesPoint } from "../components/SalesChart"
import { Loading } from "../components/Loading"
import { NoticeCard } from "../components/NoticeCard"
import { Pagination } from "../components/Pagination"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { branchNotices } from "../lib/notices"
import { useManagerSession } from "../lib/session"
import {
  addDays,
  dayKey,
  presetRange,
  rangeDays,
  rangeLabel,
  sameDay,
  startOfDay,
} from "../lib/dateRange"
import type { DateRange } from "../lib/dateRange"

const rowGrid =
  "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr] sm:items-baseline"

const PAGE_SIZE = 20

/* The backend tops its receipts copy up every minute; asking on the same
   clock keeps the figures within a minute or two of the tills */
const LIVE_REFRESH_MS = 60_000

export default function DashboardPage() {
  const { manager, store } = useManagerSession()
  const [range, setRange] = useState<DateRange>(() => presetRange("today", startOfDay(new Date())))
  const [page, setPage] = useState(1)
  /* Frozen at mount so the status rail's relative times hold still between renders */
  const [now] = useState(() => new Date())

  const notices = useApi(
    () => branchNotices({ storeId: store.id, managerId: manager.id, now }),
    [store.id, manager.id, now],
    { refreshMs: LIVE_REFRESH_MS },
  )

  useEffect(() => {
    setPage(1)
  }, [store.id, range])

  const today = startOfDay(new Date())
  const days = rangeDays(range, today)
  const singleDay = days.length === 1

  const listDays: Date[] = singleDay
    ? Array.from({ length: 7 }, (_, i) => addDays(range.start, -(i + 1)))
    : [...days].reverse()
  const listTitle = singleDay ? "Previous days" : "Daily summary"

  /*
   * Two range reads cover the chart and the list below it: the sales rows
   * for profit (they keep the full receipt history), and the audit rows for
   * expenses, advances, and the expected figure the Deposits and History
   * pages judge a day by. The ledger begins at the audit start day — earlier
   * days have sales but no audit row, so they show profit and an em dash
   * rather than a made-up expected. On a single day the list still reaches a
   * week back, so the query is widened rather than fired twice.
   */
  const spanFrom = dayKey(
    listDays.length > 0 && listDays[listDays.length - 1] < days[0] ? listDays[listDays.length - 1] : days[0] ?? today,
  )
  const spanTo = dayKey(days[days.length - 1] ?? today)
  const sales = useApi(
    () => api.dailySales([store.id], { from: spanFrom, to: spanTo }),
    [store.id, spanFrom, spanTo],
    { refreshMs: LIVE_REFRESH_MS },
  )
  const audits = useApi(
    () => api.dayAudits([store.id], { from: spanFrom, to: spanTo }),
    [store.id, spanFrom, spanTo],
    { refreshMs: LIVE_REFRESH_MS },
  )
  const hourly = useApi(
    () => (singleDay ? api.hourlySales([store.id], dayKey(days[0])) : Promise.resolve([])),
    [store.id, singleDay, singleDay ? dayKey(days[0]) : ""],
    { refreshMs: LIVE_REFRESH_MS },
  )

  const salesByDay = new Map((sales.data ?? []).map((row) => [row.day, row]))
  const auditByDay = new Map((audits.data ?? []).map((row) => [row.day, row]))
  const auditsInRange = days
    .map((d) => auditByDay.get(dayKey(d)))
    .filter((r) => r !== undefined)

  /* Every figure on the page is PROFIT — the kita. Gross sales stays on the
     wire but never on screen. */
  const chartData: SalesPoint[] = singleDay
    ? (hourly.data ?? []).map((p) => ({ label: hourLabel(p.hour), amount: p.amount }))
    : days.map((d) => ({ label: shortDate(d), amount: salesByDay.get(dayKey(d))?.profit ?? 0 }))

  const profitTotal = days.reduce(
    (sum, d) => sum + (salesByDay.get(dayKey(d))?.profit ?? 0),
    0,
  )
  const expensesTotal = auditsInRange.reduce((sum, r) => sum + r.expenses, 0)
  const advancesTotal = auditsInRange.reduce((sum, r) => sum + r.advances, 0)
  /* The ledger's own figure, summed — profit minus expenses minus cash
     advances, the same number Deposits and History judge a day by */
  const expectedTotal = auditsInRange.reduce((sum, r) => sum + r.expected, 0)

  const storeLabel = store.name
  const label = rangeLabel(range, today)

  const listTotalPages = Math.max(1, Math.ceil(listDays.length / PAGE_SIZE))
  const listPage = Math.min(page, listTotalPages)
  const pageDays = listDays.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE)

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

      {/* Gross profit for the selected range */}
      <section
        className="mt-5 rounded-xl border border-line bg-surface p-5"
        data-rise
      >
        {sales.error || audits.error || hourly.error ? (
          /* A failed read renders as a failure — ₱0.00 standing in for figures
             that never arrived would read as a very bad day that never happened */
          <div role="alert" className="py-10 text-center">
            <p className="text-[14px] text-mute">The sales figures could not load.</p>
            <button
              type="button"
              onClick={() => {
                sales.reload()
                audits.reload()
                hourly.reload()
              }}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-line-strong px-4 text-[13.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
            >
              Try again
            </button>
          </div>
        ) : sales.loading || audits.loading ? (
          <p className="py-10 text-center text-[14px]">
            <Loading label="Loading sales…" />
          </p>
        ) : days.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-mute">
            No sales data for this range yet.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <h2 className="text-[13px] font-medium text-mute">Gross profit</h2>
                <p className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-ink">
                  {peso.format(profitTotal)}
                </p>
                <p className="mt-1.5 text-[13px] text-mute">
                  {label} · {storeLabel}
                </p>
              </div>
              <dl className="flex flex-wrap gap-6">
                <div>
                  <dt className="text-[12px] text-mute">Expenses</dt>
                  <dd className="mt-0.5 text-[15px] font-medium tabular-nums text-ink-soft">
                    {peso.format(expensesTotal)}
                  </dd>
                </div>
                {advancesTotal > 0 && (
                  <div>
                    <dt className="text-[12px] text-mute">Advances</dt>
                    <dd className="mt-0.5 text-[15px] font-medium tabular-nums text-ink-soft">
                      {peso.format(advancesTotal)}
                    </dd>
                  </div>
                )}
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
              <SalesChart data={chartData} ariaLabel={`Gross profit chart, ${label}, ${storeLabel}`} />
            )}
          </>
        )}
      </section>

      {/*
        Per-day summary, paired with the status rail on wide screens. The rail
        comes first in the DOM so a phone gets what needs acting on before the
        long paged list, then `order` puts it back on the right at xl.
      */}
      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="xl:order-2">
          <NoticeCard
            title="Status"
            subtitle={`What needs attention at the ${store.name} branch.`}
            notices={notices.data ?? []}
            loading={notices.loading}
            error={notices.error}
            onRetry={notices.reload}
          />
        </div>

        <section
          className="rounded-xl border border-line bg-surface xl:order-1"
          data-rise
        >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">{listTitle}</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            Gross profit, expenses, and the expected bank deposit per day. Cash advances are
            netted out of the expected figure.
          </p>
        </div>

        <div className="mt-2 hidden gap-x-4 border-b border-line px-5 py-2.5 sm:grid sm:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <span className="text-[12px] font-medium text-mute">Date</span>
          <span className="text-right text-[12px] font-medium text-mute">Gross profit</span>
          <span className="text-right text-[12px] font-medium text-mute">Expenses</span>
          <span className="text-right text-[12px] font-medium text-mute">Expected deposit</span>
        </div>

        {sales.error || audits.error ? (
          <p role="alert" className="flex flex-wrap items-center justify-center gap-2 px-5 py-10 text-center text-[13px] text-claret">
            These figures could not load.
            <button
              type="button"
              onClick={() => {
                sales.reload()
                audits.reload()
              }}
              className="font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </p>
        ) : listDays.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-mute">
            No days in this range yet.
          </p>
        ) : (
          <>
          <ul className="divide-y divide-line">
            {pageDays.map((d) => {
              const salesRow = salesByDay.get(dayKey(d))
              const audit = auditByDay.get(dayKey(d))
              const profit = salesRow?.profit ?? audit?.profit ?? 0
              /* A day with sales but no audit row predates the ledger — an
                 em dash is honest where a figure would be invented */
              const spent = audit ? peso.format(audit.expenses) : salesRow ? "—" : peso.format(0)
              const expected = audit
                ? peso.format(audit.expected)
                : salesRow
                  ? "—"
                  : peso.format(0)
              return (
                <li key={dayKey(d)} className={rowGrid}>
                  <span className="text-[13.5px] font-medium text-ink-soft">
                    {sameDay(d, today) ? `Today, ${shortDate(d)}` : rowDate(d)}
                  </span>
                  <span className="text-right text-[14px] font-semibold tabular-nums text-ink">
                    {peso.format(profit)}
                  </span>
                  <span className="text-[12px] tabular-nums text-mute sm:text-right sm:text-[13px]">
                    <span className="sm:hidden">Expenses </span>
                    {spent}
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-mute sm:text-[13px]">
                    <span className="sm:hidden">Expected </span>
                    {expected}
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
      </div>
    </>
  )
}
