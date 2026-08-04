import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeftIcon, ArrowRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { useSheetEnter } from "../lib/motion"
import {
  MANAGER_ROUTES,
  OWNER_ROUTES,
  SEARCH_MIN,
  WINDOW_DAYS,
  buildCorpus,
  groupResults,
  runSearch,
} from "../lib/search"
import type { SearchRecord, SearchScope } from "../lib/search"

const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent)
const SHORTCUT = IS_MAC ? "⌘K" : "Ctrl K"

function DetailView({
  record,
  onBack,
  onGo,
}: {
  record: SearchRecord
  onBack: () => void
  onGo: () => void
}) {
  return (
    <div className="px-5 py-4">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] font-medium text-mute transition-colors duration-200 ease-quiet hover:text-ink"
      >
        <ArrowLeftIcon size={14} weight="bold" aria-hidden="true" />
        Back to results
      </button>

      <h3 className="mt-3 text-[16px] font-semibold text-ink">{record.title}</h3>
      <p className="mt-0.5 text-[13px] text-mute">{record.subtitle}</p>

      <dl className="mt-4 divide-y divide-line border-y border-line">
        {record.details.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-[13px] text-mute">{row.label}</dt>
            <dd
              className={`min-w-0 text-right text-[13.5px] font-medium tabular-nums ${
                row.tone === "bad"
                  ? "text-claret"
                  : row.tone === "good"
                    ? "text-sage-ink"
                    : "text-ink"
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={onGo}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink text-[14.5px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985]"
      >
        {record.toLabel}
        <ArrowRightIcon size={15} weight="bold" aria-hidden="true" />
      </button>
    </div>
  )
}

function SearchOverlay({ scope, onClose }: { scope: SearchScope; onClose: () => void }) {
  const navigate = useNavigate()
  const backdropRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [opened, setOpened] = useState<SearchRecord | null>(null)

  useSheetEnter(panelRef, backdropRef, true)

  /* Fetched once, when the overlay opens — the keystrokes only filter it */
  const [corpus, setCorpus] = useState<SearchRecord[]>([])
  const [indexing, setIndexing] = useState(true)

  useEffect(() => {
    let live = true
    setIndexing(true)
    buildCorpus(scope, new Date())
      .then((records) => {
        if (!live) return
        setCorpus(records)
        setIndexing(false)
      })
      .catch(() => {
        if (live) setIndexing(false)
      })
    return () => {
      live = false
    }
  }, [scope])

  const results = useMemo(() => runSearch(corpus, query), [corpus, query])
  const groups = useMemo(() => groupResults(results), [results])
  /* Flattened in display order, so the arrow keys walk across group borders */
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        if (opened) setOpened(null)
        else onClose()
        return
      }
      if (opened) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActive((i) => Math.min(i + 1, flat.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter" && flat[active]) {
        e.preventDefault()
        setOpened(flat[active])
      }
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [opened, onClose, flat, active])

  /* Keep the keyboard cursor on screen without scrolling the panel itself */
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

  const go = (record: SearchRecord) => {
    navigate(record.to)
    onClose()
  }

  const tooShort = query.trim().length < SEARCH_MIN

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center px-4 pb-4 pt-[max(3.5rem,8vh)]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <button
        ref={backdropRef}
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-ink/25"
      />

      <div
        ref={panelRef}
        className="relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_48px_rgba(21,22,19,0.18)]"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <MagnifyingGlassIcon size={18} aria-hidden="true" className="shrink-0 text-mute" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpened(null)
            }}
            placeholder="Search days, expenses, deposits…"
            aria-label="Search"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-mute"
          />
          {!tooShort && (
            <span className="shrink-0 text-[12px] tabular-nums text-mute">
              {results.length} {results.length === 1 ? "result" : "results"}
            </span>
          )}
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {opened ? (
            <DetailView record={opened} onBack={() => setOpened(null)} onGo={() => go(opened)} />
          ) : tooShort ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[13.5px] text-ink-soft">
                Search by date, word, or number.
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-mute">
                “july 3 2026” · “meals arevalo” · “discrepancy” · an amount like “480” · a deposit
                reference like “712063”
              </p>
            </div>
          ) : indexing ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-mute">Searching…</p>
          ) : groups.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13.5px] text-mute">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            <>
              {groups.map((group) => (
                <section key={group.kind}>
                  <h3 className="sticky top-0 bg-canvas px-5 py-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-mute">
                    {group.label}
                    {group.total > group.items.length && (
                      <span className="normal-case tracking-normal">
                        {" "}
                        · showing {group.items.length} of {group.total}
                      </span>
                    )}
                  </h3>
                  <ul>
                    {group.items.map((record) => {
                      const isActive = flat[active]?.id === record.id
                      return (
                        <li key={record.id}>
                          <button
                            type="button"
                            data-active={isActive}
                            onMouseEnter={() => setActive(flat.findIndex((r) => r.id === record.id))}
                            onClick={() => setOpened(record)}
                            className={`flex w-full items-baseline justify-between gap-3 px-5 py-2.5 text-left transition-colors duration-200 ease-quiet ${
                              isActive ? "bg-black/[0.04]" : ""
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px] font-medium text-ink">
                                {record.title}
                              </span>
                              <span className="mt-0.5 block truncate text-[12.5px] text-mute">
                                {record.subtitle}
                              </span>
                            </span>
                            {record.meta && (
                              <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-ink-soft">
                                {record.meta}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
              <p className="border-t border-line px-5 py-2.5 text-[12px] text-mute">
                Covers the last {WINDOW_DAYS} days. Enter opens a result, Esc closes.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/*
 * App-wide search, mounted by both shells. The trigger floats clear of the
 * mobile tab bar and sits bottom-right on a desktop.
 *
 * Rendered at shell level rather than portalled: useRouteReveal only holds a
 * transform on [data-rise] elements inside <main>, so nothing here is trapped
 * inside a containing block the way a page-level fixed element would be.
 */
export function GlobalSearch({ storeIds, owner }: { storeIds: string[]; owner: boolean }) {
  const [open, setOpen] = useState(false)

  /* Keyed on the joined ids so the scope — and the corpus built from it — stays
     stable across the parent's re-renders */
  const storeKey = storeIds.join(",")
  const scope = useMemo<SearchScope>(
    () => ({
      storeIds: storeKey.split(","),
      routes: owner ? OWNER_ROUTES : MANAGER_ROUTES,
      includeAccounts: owner,
    }),
    [storeKey, owner],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-ink-soft shadow-[0_4px_16px_rgba(21,22,19,0.12)] transition-[transform,color] duration-200 ease-quiet hover:text-ink active:scale-95 lg:bottom-6 lg:right-6"
      >
        <MagnifyingGlassIcon size={19} aria-hidden="true" />
        <span className="hidden text-[14px] font-medium lg:inline">Search</span>
        <span className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-mute lg:inline">
          {SHORTCUT}
        </span>
      </button>

      {open && <SearchOverlay scope={scope} onClose={() => setOpen(false)} />}
    </>
  )
}
