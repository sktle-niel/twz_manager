import { useState } from "react"
import type { CSSProperties } from "react"
import { CalendarBlankIcon, StorefrontIcon } from "@phosphor-icons/react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { compact, hourLabel, peso, rowDate, shortDate } from "../lib/format"
import { FilterSelect, controlClass } from "../components/ui"
import {
  STORES,
  dayKey,
  expensesFor,
  grossSalesFor,
  visibleHourlySales,
} from "../lib/mock"

type RangePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "custom"

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "custom", label: "Custom range" },
]

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}
function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b)
}
function parseInputDate(v: string): Date | null {
  const [y, m, d] = v.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

type TipProps = {
  active?: boolean
  label?: string | number
  payload?: { value?: number | string }[]
}

function ChartTip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-[0_2px_8px_rgba(21,22,19,0.06)]">
      <p className="text-[12px] text-mute">{label}</p>
      <p className="text-[13.5px] font-semibold tabular-nums text-ink">
        {peso.format(Number(payload[0].value ?? 0))}
      </p>
    </div>
  )
}

const axisTick = { fill: "#6e6d66", fontSize: 11 }
const rowGrid =
  "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr] sm:items-baseline"

export default function DashboardPage() {
  const [storeId, setStoreId] = useState("all")
  const [preset, setPreset] = useState<RangePreset>("today")
  const [customFrom, setCustomFrom] = useState(() => dayKey(addDays(new Date(), -6)))
  const [customTo, setCustomTo] = useState(() => dayKey(new Date()))

  const today = startOfDay(new Date())

  let range: { start: Date; end: Date } | null
  switch (preset) {
    case "today":
      range = { start: today, end: today }
      break
    case "yesterday": {
      const y = addDays(today, -1)
      range = { start: y, end: y }
      break
    }
    case "last7":
      range = { start: addDays(today, -6), end: today }
      break
    case "last30":
      range = { start: addDays(today, -29), end: today }
      break
    case "thisMonth":
      range = { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }
      break
    case "custom": {
      const from = parseInputDate(customFrom)
      const to = parseInputDate(customTo)
      range = from && to ? { start: startOfDay(from), end: startOfDay(to) } : null
      break
    }
  }

  const invalidRange = range !== null && range.start > range.end
  // Future days have no sales yet; clamp the data window to today
  const effectiveEnd = range && range.end > today ? today : range?.end ?? null
  const noData = range !== null && !invalidRange && range.start > today

  const days: Date[] = []
  if (range && effectiveEnd && !invalidRange && !noData) {
    for (let d = range.start; d <= effectiveEnd && days.length < 92; d = addDays(d, 1)) {
      days.push(d)
    }
  }

  const storeIds = storeId === "all" ? STORES.map((s) => s.id) : [storeId]
  const singleDay = days.length === 1

  let chartData: { label: string; amount: number }[] = []
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

  const storeLabel =
    storeId === "all" ? "All branches" : STORES.find((s) => s.id === storeId)?.name ?? ""
  let rangeLabel: string
  if (preset === "custom" && range) {
    rangeLabel = sameDay(range.start, range.end)
      ? shortDate(range.start)
      : `${shortDate(range.start)} to ${shortDate(range.end)}`
  } else {
    rangeLabel = PRESETS.find((p) => p.value === preset)?.label ?? ""
  }

  const singleDayPreset = preset === "today" || preset === "yesterday"
  const listDays: Date[] = singleDayPreset
    ? Array.from({ length: 7 }, (_, i) => addDays(range!.start, -(i + 1)))
    : [...days].reverse()
  const listTitle = singleDayPreset ? "Previous days" : "Daily summary"

  return (
    <>
      <h1
        className="anim-rise mt-6 text-[22px] font-semibold tracking-[-0.01em] text-ink"
        style={{ "--index": 0 } as CSSProperties}
      >
        Dashboard
      </h1>

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
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </FilterSelect>

        {preset === "custom" && (
          <span className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Start date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={`${controlClass} px-3`}
            />
            <span className="text-[13px] text-mute">to</span>
            <input
              type="date"
              aria-label="End date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className={`${controlClass} px-3`}
            />
          </span>
        )}
      </div>

      {/* Gross sales for the selected range */}
      <section
        className="anim-rise mt-5 rounded-xl border border-line bg-surface p-5"
        style={{ "--index": 2 } as CSSProperties}
      >
        {invalidRange ? (
          <p className="py-10 text-center text-[14px] text-mute">
            The start date is after the end date. Adjust the range to see sales.
          </p>
        ) : noData ? (
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
                  {rangeLabel} · {storeLabel}
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
              <div
                className="mt-5 h-56 sm:h-64"
                role="img"
                aria-label={`Gross sales chart, ${rangeLabel}, ${storeLabel}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  {singleDay ? (
                    <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e7d1b" stopOpacity={0.14} />
                          <stop offset="100%" stopColor="#1e7d1b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e9e8e4" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={axisTick}
                        tickMargin={8}
                        minTickGap={24}
                      />
                      <YAxis
                        width={44}
                        tickLine={false}
                        axisLine={false}
                        tick={axisTick}
                        tickFormatter={(v: number) => `₱${compact.format(v)}`}
                      />
                      <Tooltip
                        content={<ChartTip />}
                        cursor={{ stroke: "#8f8e86", strokeDasharray: "3 3" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#1e7d1b"
                        strokeWidth={1.75}
                        fill="url(#salesFill)"
                        isAnimationActive={false}
                        activeDot={{ r: 3.5, fill: "#1e7d1b", stroke: "#ffffff" }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e9e8e4" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={axisTick}
                        tickMargin={8}
                        minTickGap={28}
                      />
                      <YAxis
                        width={44}
                        tickLine={false}
                        axisLine={false}
                        tick={axisTick}
                        tickFormatter={(v: number) => `₱${compact.format(v)}`}
                      />
                      <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(21,22,19,0.04)" }} />
                      <Bar
                        dataKey="amount"
                        fill="#1e7d1b"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={26}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      {/* Per-day summary */}
      <section
        className="anim-rise mt-5 rounded-xl border border-line bg-surface"
        style={{ "--index": 3 } as CSSProperties}
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
          <ul className="divide-y divide-line">
            {listDays.map((d) => {
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
        )}
      </section>
    </>
  )
}
