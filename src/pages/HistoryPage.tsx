import { useState } from "react"
import type { CSSProperties } from "react"
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  FunnelIcon,
  StorefrontIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { peso, rowDate, shortDate } from "../lib/format"
import { STORES, dayAuditFor, dayKey } from "../lib/mock"
import type { DayStatus } from "../lib/mock"
import { FilterSelect } from "../components/ui"

type RangePreset = "last7" | "last30" | "thisMonth" | "lastMonth"
type StatusFilter = "all" | DayStatus

const RANGES: { value: RangePreset; label: string }[] = [
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
]

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "matched", label: "Matched" },
  { value: "discrepancy", label: "Discrepancy" },
  { value: "pending", label: "Pending deposit" },
  { value: "open", label: "Open" },
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

function StatusChip({ status }: { status: DayStatus }) {
  switch (status) {
    case "matched":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink">
          <CheckCircleIcon size={12} weight="fill" aria-hidden="true" />
          Matched
        </span>
      )
    case "discrepancy":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-claret/10 px-2 py-0.5 text-[11px] font-medium text-claret">
          <WarningCircleIcon size={12} weight="fill" aria-hidden="true" />
          Discrepancy
        </span>
      )
    case "pending":
      return (
        <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-medium text-ink-soft">
          Pending deposit
        </span>
      )
    case "open":
      return (
        <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-mute">
          Open
        </span>
      )
  }
}

export default function HistoryPage() {
  const [storeId, setStoreId] = useState("arevalo")
  const [preset, setPreset] = useState<RangePreset>("last30")
  const [status, setStatus] = useState<StatusFilter>("all")

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
    case "thisMonth":
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = today
      break
    case "lastMonth":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
      break
  }

  const rows: { date: Date; audit: ReturnType<typeof dayAuditFor> }[] = []
  for (let d = end; d >= start && rows.length < 62; d = addDays(d, -1)) {
    const audit = dayAuditFor(storeId, d)
    if (status === "all" || audit.status === status) {
      rows.push({ date: d, audit })
    }
  }

  const storeName = STORES.find((s) => s.id === storeId)?.name ?? ""

  return (
    <>
      <div className="anim-rise mt-6" style={{ "--index": 0 } as CSSProperties}>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">History</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Every audited day and how its deposit reconciled.
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
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          ariaLabel="Status"
          icon={<FunnelIcon size={15} weight="bold" aria-hidden="true" />}
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterSelect>
      </div>

      {/* Day-by-day audit list */}
      <section
        className="anim-rise mt-5 rounded-xl border border-line bg-surface"
        style={{ "--index": 2 } as CSSProperties}
      >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">{storeName} branch</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            Expected deposit is gross sales minus logged expenses for the day.
          </p>
        </div>

        <div className="mt-2 hidden gap-x-4 border-b border-line px-5 py-2.5 sm:grid sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
          <span className="text-[12px] font-medium text-mute">Date</span>
          <span className="text-right text-[12px] font-medium text-mute">Gross sales</span>
          <span className="text-right text-[12px] font-medium text-mute">Expected</span>
          <span className="text-right text-[12px] font-medium text-mute">Deposited</span>
          <span className="text-right text-[12px] font-medium text-mute">Status</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-mute">
            No days match these filters.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ date, audit }) => (
              <li
                key={dayKey(date)}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]"
              >
                <span className="text-[13.5px] font-medium text-ink-soft sm:order-1">
                  {audit.status === "open" ? `Today, ${shortDate(date)}` : rowDate(date)}
                </span>
                <span className="text-right text-[14px] font-semibold tabular-nums text-ink sm:order-3 sm:text-[13.5px]">
                  {peso.format(audit.expected)}
                </span>
                <span className="sm:order-5 sm:justify-self-end">
                  <StatusChip status={audit.status} />
                </span>
                <span className="text-right text-[12px] tabular-nums text-mute sm:order-4 sm:text-[13px]">
                  {audit.deposited === null ? (
                    audit.status === "open" ? (
                      "Still open"
                    ) : (
                      "Not yet deposited"
                    )
                  ) : (
                    <>
                      <span className="sm:hidden">Deposited </span>
                      {peso.format(audit.deposited)}
                    </>
                  )}
                </span>
                <span className="hidden text-right text-[13px] tabular-nums text-mute sm:order-2 sm:block">
                  {peso.format(audit.gross)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
