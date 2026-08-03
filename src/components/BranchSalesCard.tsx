/*
 * Owner rail: what each branch has taken in over the selected range, ranked
 * highest first, with a bar against the leader so the gap is readable at a
 * glance. Every branch is listed even when the page is filtered to one, since
 * the comparison is the point — the filtered branch is just marked.
 */
import { peso } from "../lib/format"

export type BranchSales = { id: string; name: string; amount: number }

export function BranchSalesCard({
  title,
  subtitle,
  rows,
  total,
  highlightId,
}: {
  title: string
  subtitle?: string
  rows: BranchSales[]
  total: number
  highlightId?: string | null
}) {
  const leader = rows[0]?.amount ?? 0

  return (
    <section className="rounded-xl border border-line bg-surface" data-rise>
      <div className="px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-mute">{subtitle}</p>}
      </div>
      <ol className="divide-y divide-line border-t border-line">
        {rows.map((r, i) => {
          const share = total > 0 ? Math.round((r.amount / total) * 100) : 0
          const bar = leader > 0 ? (r.amount / leader) * 100 : 0
          const active = r.id === highlightId
          return (
            <li key={r.id} className={`px-5 py-3 ${active ? "bg-sage" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-3 shrink-0 text-[12px] tabular-nums text-mute">{i + 1}</span>
                  <span
                    className={`truncate text-[13.5px] font-medium ${
                      active ? "text-sage-ink" : "text-ink-soft"
                    }`}
                  >
                    {r.name}
                  </span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">
                  {peso.format(r.amount)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2.5 pl-5">
                <span aria-hidden="true" className="h-1 flex-1 rounded-full bg-ink/10">
                  <span
                    className="block h-full rounded-full bg-brand-deep/70"
                    style={{ width: `${bar}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-[11.5px] tabular-nums text-mute">
                  {share}%
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="flex items-baseline justify-between gap-3 border-t border-line px-5 py-3">
        <span className="text-[13px] font-semibold text-ink">All branches</span>
        <span className="text-[14px] font-semibold tabular-nums text-ink">{peso.format(total)}</span>
      </div>
    </section>
  )
}
