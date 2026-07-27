/*
 * Narrow summary card used as the right-hand rail beside a wide list or
 * table on large screens. Deliberately plain: label/value rows, no icons
 * or colour, so it reads as part of the document rather than a widget.
 */
export type Stat = { label: string; value: string; hint?: string }

export function StatCard({
  title,
  subtitle,
  stats,
}: {
  title: string
  subtitle?: string
  stats: Stat[]
}) {
  return (
    <section className="rounded-xl border border-line bg-surface" data-rise>
      <div className="px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-mute">{subtitle}</p>}
      </div>
      <dl className="divide-y divide-line border-t border-line">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-3 px-5 py-3">
            <dt className="min-w-0">
              <span className="block text-[13px] text-ink-soft">{s.label}</span>
              {s.hint && <span className="mt-0.5 block text-[12px] text-mute">{s.hint}</span>}
            </dt>
            <dd className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
