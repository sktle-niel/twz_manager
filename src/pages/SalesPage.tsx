import { useState } from "react"
import { peso } from "../lib/format"
import { BranchTag } from "../components/ui"
import { DateRangePicker } from "../components/DateRangePicker"
import { Loading } from "../components/Loading"
import { api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useManagerSession } from "../lib/session"
import { dayKey, presetRange, rangeLabel, startOfDay } from "../lib/dateRange"
import type { DateRange } from "../lib/dateRange"
import type { SoldItem } from "../lib/api/types"

/* Same clock the dashboard keeps: the backend tops its receipts copy up every
   minute, so asking on the same cadence stays within a minute of the tills */
const LIVE_REFRESH_MS = 60_000

const row =
  "grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-5 py-3 sm:grid-cols-[1fr_5rem_7rem] sm:items-baseline"

/*
 * What the branch actually sold, line by line.
 *
 * The split is the ledger's own: goods are net sales, services and labor are
 * not. Both are real money that crossed the counter, which is exactly why
 * labor is shown here rather than hidden — a manager holding cash for a
 * ₱500 wheel alignment should be able to see it, and see that it is not part
 * of what the bank expects.
 */
export default function SalesPage() {
  const { store } = useManagerSession()
  const [range, setRange] = useState<DateRange>(() => presetRange("today", startOfDay(new Date())))

  const today = startOfDay(new Date())
  const from = dayKey(range.start)
  const to = dayKey(range.end)

  const sales = useApi(
    () => api.itemSales(store.id, { from, to }),
    [store.id, from, to],
    { refreshMs: LIVE_REFRESH_MS },
  )

  const data = sales.data
  const nothing =
    data !== null && data.parts.length === 0 && data.labor.length === 0

  return (
    <>
      <h1
        className="mt-6 text-[22px] font-semibold tracking-[-0.01em] text-ink"
        data-rise
      >
        Sales
      </h1>
      <p className="mt-1 text-[13px] text-mute" data-rise>
        What sold, and the labor beside it.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5" data-rise>
        <BranchTag name={store.name} />
        <DateRangePicker value={range} onChange={setRange} today={today} />
      </div>

      {sales.error ? (
        <section
          className="mt-5 rounded-xl border border-line bg-surface p-5"
          data-rise
        >
          {/* A failed read renders as a failure — an empty table would read as
              a day with no sales, which is a very different fact */}
          <div role="alert" className="py-10 text-center">
            <p className="text-[14px] text-mute">The sales figures could not load.</p>
            <button
              type="button"
              onClick={() => sales.reload()}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg border border-line-strong px-4 text-[13.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
            >
              Try again
            </button>
          </div>
        </section>
      ) : sales.loading && data === null ? (
        <section className="mt-5 rounded-xl border border-line bg-surface p-5" data-rise>
          <Loading label="Loading sales" />
        </section>
      ) : data === null ? null : (
        <>
          {/* The two totals, side by side, because the whole point of the page
              is that they are different kinds of money */}
          <section className="mt-5 grid gap-3 sm:grid-cols-2" data-rise>
            <div className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-[13px] font-medium text-mute">Net sales</h2>
              <p className="mt-1 text-[26px] font-semibold tracking-[-0.01em] text-ink tabular-nums">
                {peso.format(data.partsTotal)}
              </p>
              <p className="mt-1 text-[12px] text-mute">
                Goods sold — this is what the deposit answers for.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-[13px] font-medium text-mute">Labor &amp; services</h2>
              <p className="mt-1 text-[26px] font-semibold tracking-[-0.01em] text-ink tabular-nums">
                {peso.format(data.laborTotal)}
              </p>
              <p className="mt-1 text-[12px] text-mute">
                Money taken, but never counted toward net sales.
              </p>
            </div>
          </section>

          {nothing ? (
            <section
              className="mt-4 rounded-xl border border-line bg-surface p-5"
              data-rise
            >
              <p className="py-10 text-center text-[14px] text-mute">
                Nothing sold in {rangeLabel(range, today)}.
              </p>
            </section>
          ) : (
            <>
              <ItemTable
                title="Sold"
                subtitle="Counted toward net sales"
                items={data.parts}
                total={data.partsTotal}
              />
              <ItemTable
                title="Labor & services"
                subtitle="Not counted toward net sales"
                items={data.labor}
                total={data.laborTotal}
              />
            </>
          )}
        </>
      )}
    </>
  )
}

function ItemTable({
  title,
  subtitle,
  items,
  total,
}: {
  title: string
  subtitle: string
  items: SoldItem[]
  total: number
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <section
      className="mt-4 overflow-hidden rounded-xl border border-line bg-surface"
      data-rise
    >
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        <p className="mt-0.5 text-[12px] text-mute">{subtitle}</p>
      </header>

      <div className={`${row} border-b border-line`}>
        <span className="text-[12px] font-medium text-mute">Item</span>
        <span className="hidden text-right text-[12px] font-medium text-mute sm:block">
          Qty
        </span>
        <span className="hidden text-right text-[12px] font-medium text-mute sm:block">
          Amount
        </span>
      </div>

      <ul>
        {items.map((item) => (
          <li
            key={`${item.sku ?? "no-sku"}|${item.name}`}
            className={`${row} border-b border-line last:border-b-0`}
          >
            <span className="text-[14px] text-ink">
              {item.name}
              {item.sku ? (
                <span className="ml-2 text-[12px] text-mute tabular-nums">{item.sku}</span>
              ) : null}
            </span>
            {/* On a phone the quantity rides under the name rather than in a
                column of its own — three columns do not fit honestly */}
            <span className="text-right text-[13px] text-mute tabular-nums sm:hidden">
              {formatQty(item.quantity)} · {peso.format(item.amount)}
            </span>
            <span className="hidden text-right text-[14px] text-mute tabular-nums sm:block">
              {formatQty(item.quantity)}
            </span>
            <span className="hidden text-right text-[14px] font-medium text-ink tabular-nums sm:block">
              {peso.format(item.amount)}
            </span>
          </li>
        ))}
      </ul>

      <div className={`${row} border-t border-line bg-canvas`}>
        <span className="text-[13px] font-medium text-ink">Total</span>
        <span className="hidden sm:block" />
        <span className="text-right text-[14px] font-semibold text-ink tabular-nums">
          {peso.format(total)}
        </span>
      </div>
    </section>
  )
}

/* Loyverse allows fractional quantities; whole ones must not read as "12.000" */
function formatQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3).replace(/0+$/, "")
}
