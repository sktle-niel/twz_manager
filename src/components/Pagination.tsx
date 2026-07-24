import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"

/*
 * Page controls for long lists. Slicing happens client-side today because all
 * data is deterministic mock, but the props (page / pageSize / total) map 1:1
 * onto an offset+limit API call — moving to server-side paging swaps the data
 * source, not this component. Renders nothing when everything fits on one page.
 */
function pageItems(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const items: (number | "gap")[] = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(totalPages - 1, page + 1)
  if (from > 2) items.push("gap")
  for (let p = from; p <= to; p++) items.push(p)
  if (to < totalPages - 1) items.push("gap")
  items.push(totalPages)
  return items
}

const navButton =
  "flex h-8 w-8 items-center justify-center rounded-lg text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink disabled:pointer-events-none disabled:opacity-30"

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  unit = "rows",
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  unit?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-3">
      <p className="text-[12.5px] tabular-nums text-mute">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {unit}
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={navButton}
        >
          <CaretLeftIcon size={14} weight="bold" aria-hidden="true" />
        </button>

        <span className="px-2 text-[12.5px] tabular-nums text-mute sm:hidden">
          {page} / {totalPages}
        </span>

        <span className="hidden items-center gap-1 sm:flex">
          {pageItems(page, totalPages).map((item, i) =>
            item === "gap" ? (
              <span
                key={`gap-${i}`}
                aria-hidden="true"
                className="px-1 text-[12.5px] text-mute"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] tabular-nums transition-colors duration-200 ease-quiet ${
                  item === page
                    ? "bg-sage font-semibold text-sage-ink"
                    : "text-ink-soft hover:bg-black/[0.04] hover:text-ink"
                }`}
              >
                {item}
              </button>
            ),
          )}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={navButton}
        >
          <CaretRightIcon size={14} weight="bold" aria-hidden="true" />
        </button>
      </nav>
    </div>
  )
}
