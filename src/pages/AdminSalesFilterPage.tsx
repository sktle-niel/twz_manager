import { useEffect, useRef, useState } from "react"
import { FunnelIcon, MagnifyingGlassIcon, PlusIcon, XIcon } from "@phosphor-icons/react"
import { ApiError, api } from "../lib/api"
import type { FilteredItem } from "../lib/api"
import { useApi } from "../lib/useApi"
import { Loading } from "../components/Loading"
import { inputBase, inputOk } from "../components/ui"
import { useToast } from "../lib/toast"

/*
 * Which items never count toward gross and profit — services and labor,
 * whose money is not the drawer's to deposit. The search asks the backend,
 * which walks the POS catalog once and caches it; this page never pulls the
 * whole catalog, only the matches for what was typed.
 */
export default function AdminSalesFilterPage() {
  const { showToast } = useToast()
  const loaded = useApi(() => api.salesFilter(), [])

  /* The list being edited; null means "as loaded". Add/remove stage changes
     here — nothing reaches the backend until Save, because every saved
     change of SKUs costs a full sales re-pull. */
  const [edits, setEdits] = useState<FilteredItem[] | null>(null)
  const items = edits ?? loaded.data ?? []
  const dirty = edits !== null

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<FilteredItem[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /* Answers can land out of order; only the latest question counts */
  const searchSeq = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      setSearchError(null)
      return
    }
    const seq = ++searchSeq.current
    setSearching(true)
    const wait = setTimeout(() => {
      api
        .searchCatalog(q)
        .then((found) => {
          if (searchSeq.current !== seq) return
          setResults(found)
          setSearchError(null)
          setSearching(false)
        })
        .catch((err) => {
          if (searchSeq.current !== seq) return
          setResults([])
          setSearchError(err instanceof ApiError ? err.message : "The search failed. Try again.")
          setSearching(false)
        })
    }, 350)
    return () => clearTimeout(wait)
  }, [query])

  const excluded = new Set(items.map((i) => i.sku))

  function add(item: FilteredItem) {
    if (excluded.has(item.sku)) return
    setEdits([...items, item])
  }

  function remove(item: FilteredItem) {
    setEdits(items.filter((i) => i.sku !== item.sku))
  }

  async function save() {
    if (edits === null) return
    setSaving(true)
    try {
      await api.saveSalesFilter(edits)
      setEdits(null)
      loaded.reload()
      showToast("Saved. The sales history is recomputing — figures refill within a few minutes.")
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Saving failed. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-6" data-rise>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Sales filter</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Items that never count toward gross profit — services and labor are not the drawer's
          money, so they must not raise the expected deposits.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {/* Find items to filter out */}
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" data-rise>
          <h2 className="text-[15px] font-semibold text-ink">Add an item</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            The search asks the POS catalog — nothing is downloaded until you type.
          </p>

          <div className="relative mt-3">
            <MagnifyingGlassIcon
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 mt-1 -translate-y-1/2 text-mute"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the catalog by item name or SKU"
              aria-label="Search the catalog"
              className={`${inputBase} ${inputOk} pl-9`}
            />
          </div>

          {searching && (
            <p className="mt-3">
              <Loading className="text-[13px]" />
            </p>
          )}
          {searchError && (
            <p role="alert" className="mt-3 text-[13px] text-claret">
              {searchError}
            </p>
          )}
          {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-3 text-[13.5px] text-mute">Nothing in the catalog matches that.</p>
          )}

          {results.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
              {results.map((item) => {
                const already = excluded.has(item.sku)
                return (
                  <li key={item.sku} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-soft">
                        {item.name || item.sku}
                      </span>
                      <span className="block text-[12px] tabular-nums text-mute">SKU {item.sku}</span>
                    </span>
                    {already ? (
                      <span className="shrink-0 text-[12px] font-medium text-mute">Filtered</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(item)}
                        className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
                      >
                        <PlusIcon size={13} weight="bold" aria-hidden="true" />
                        Add
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Everything currently filtered out */}
        <section className="rounded-xl border border-line bg-surface" data-rise>
          <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4 sm:px-6">
            <div>
              <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                <FunnelIcon size={15} weight="bold" aria-hidden="true" />
                Filtered out of sales
              </h2>
              <p className="mt-0.5 text-[13px] text-mute">
                Lines with these SKUs are removed from every receipt's figures.
              </p>
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-mute">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>

          {loaded.error ? (
            <p
              role="alert"
              className="flex flex-wrap items-center gap-2 px-5 pb-5 pt-2 text-[13px] text-claret sm:px-6"
            >
              The list could not load.
              <button
                type="button"
                onClick={loaded.reload}
                className="font-medium underline underline-offset-4"
              >
                Try again
              </button>
            </p>
          ) : items.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-[13.5px] text-mute sm:px-6">
              {loaded.loading ? <Loading /> : "Nothing is filtered — every item counts toward sales."}
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {items.map((item) => (
                <li key={item.sku} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink-soft">
                      {item.name || item.sku}
                    </span>
                    <span className="block text-[12px] tabular-nums text-mute">SKU {item.sku}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label={`Count ${item.name || item.sku} toward sales again`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
                  >
                    <XIcon size={14} weight="bold" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40"
            >
              {saving ? "Saving" : "Save changes"}
            </button>
            <p className="text-[12.5px] leading-[1.5] text-mute">
              Saving re-pulls the sales history from the POS so past figures agree with this
              list. Charts refill within a few minutes.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
