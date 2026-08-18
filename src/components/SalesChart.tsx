/*
 * Shared sales chart, used for both a single day (hourly points) and
 * multi-day ranges (one point per day), by the manager dashboard and the owner
 * overview so the two graphs stay identical.
 *
 * Straight segments rather than a smoothed curve: each point is a real reading,
 * and a monotone spline invents values between them — it would bow above a
 * plotted figure and read as sales that never happened.
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { compact, peso } from "../lib/format"

export type SalesPoint = { label: string; amount: number }

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

const BRAND = "#1e7d1b"
const LINE = "#e9e8e4"

/*
 * Past this many readings the per-point marks and the vertical grid stop
 * helping: the dots run together and the grid fills in solid. A quarter of
 * daily figures crosses it; every hourly day and every month does not.
 */
const DENSE_AFTER = 31

export function SalesChart({ data, ariaLabel }: { data: SalesPoint[]; ariaLabel: string }) {
  const dense = data.length > DENSE_AFTER

  return (
    <div className="mt-5 h-56 sm:h-64 xl:h-[20rem] 2xl:h-[22rem]" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.14} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={!dense} stroke={LINE} />
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
          {/* Full-height solid rule rather than a dashed grey one: it reads as
              part of the series it is measuring, not as another gridline */}
          <Tooltip content={<ChartTip />} cursor={{ stroke: BRAND, strokeWidth: 1 }} />
          <Area
            type="linear"
            dataKey="amount"
            stroke={BRAND}
            strokeWidth={1.75}
            fill="url(#salesFill)"
            isAnimationActive={false}
            dot={dense ? false : { r: 2.5, fill: BRAND, stroke: "#ffffff", strokeWidth: 1 }}
            activeDot={{ r: 4.5, fill: "#ffffff", stroke: BRAND, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
