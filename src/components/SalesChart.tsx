/*
 * Shared gross-sales chart: a smooth area chart, used for both a single day
 * (hourly points) and multi-day ranges (one point per day). Used by the
 * manager dashboard and the owner overview so the two graphs stay identical.
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

export function SalesChart({ data, ariaLabel }: { data: SalesPoint[]; ariaLabel: string }) {
  return (
    <div className="mt-5 h-56 sm:h-64 xl:h-[20rem] 2xl:h-[22rem]" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
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
          <Tooltip content={<ChartTip />} cursor={{ stroke: "#8f8e86", strokeDasharray: "3 3" }} />
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
      </ResponsiveContainer>
    </div>
  )
}
