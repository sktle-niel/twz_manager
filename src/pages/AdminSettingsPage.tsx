import { useState } from "react"
import type { ReactNode, SubmitEvent } from "react"
import {
  CheckCircleIcon,
  PlugsConnectedIcon,
  PlusIcon,
  ShieldCheckIcon,
  StorefrontIcon,
  TagIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { ApiError, api } from "../lib/api"
import type { ExpenseCategoryConfig } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useOwnerSession } from "../lib/session"
import { inputBad, inputFlush, inputOk } from "../components/ui"
import { RowMenu } from "../components/RowMenu"
import { useToast } from "../lib/toast"

function SettingCard({
  icon: CardIcon,
  title,
  subtitle,
  children,
}: {
  icon: Icon
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" data-rise>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage text-sage-ink">
          <CardIcon size={18} weight="bold" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[13px] text-mute">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/*
 * A category carries an id of its own so a rename cannot lose track of which
 * row is which. `receiptExempt` holds the receipt rule as data rather than as a
 * hardcoded pair of names: a category the owner marks exempt is company-covered
 * and logged without proof, which is how meals and merienda work today. Because
 * the rule now travels with the category, any of them can be removed — nothing
 * else points at a particular name.
 */
type Category = ExpenseCategoryConfig

export default function AdminSettingsPage() {
  const { showToast } = useToast()
  const { stores } = useOwnerSession()

  const loadedCategories = useApi(() => api.expenseCategories(), [])
  const pos = useApi(() => api.posConnection(), [])
  const loadedRules = useApi(() => api.reconciliationRules(), [])

  /* Edited locally, then written back in one call — the list is small and a
     round trip per keystroke would fight the inline rename. The write is
     optimistic: on rejection the list snaps back and the failure is said out
     loud, so a change that did not survive can never sit there looking saved. */
  const [edits, setEdits] = useState<Category[] | null>(null)
  const categories = edits ?? loadedCategories.data ?? []
  const setCategories = (next: Category[] | ((prev: Category[]) => Category[])) => {
    const value = typeof next === "function" ? next(categories) : next
    const previous = categories
    setEdits(value)
    api
      .saveExpenseCategories(value)
      .then((saved) => setEdits(saved))
      .catch((err: unknown) => {
        setEdits(previous)
        showToast(err instanceof ApiError ? err.message : "The change did not save. Try again.")
      })
  }

  const [newCategory, setNewCategory] = useState("")
  const [addError, setAddError] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [editError, setEditError] = useState("")

  const [batchWindowEdit, setBatchWindowEdit] = useState<string | null>(null)
  const batchWindow = batchWindowEdit ?? String(loadedRules.data?.batchWindowDays ?? 3)
  const setBatchWindow = setBatchWindowEdit

  /* Two categories with the same name would make the manager's picker ambiguous */
  function nameTaken(name: string, exceptId?: string): boolean {
    const value = name.trim().toLowerCase()
    return categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === value)
  }

  function addCategory(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = newCategory.trim()
    if (!value) {
      setAddError("Enter a category name.")
      return
    }
    if (nameTaken(value)) {
      setAddError(`${value} is already a category.`)
      return
    }
    // A new category needs proof until the owner says otherwise
    setCategories((prev) => [
      ...prev,
      { id: `c-${Date.now().toString(36)}`, name: value, receiptExempt: false },
    ])
    setNewCategory("")
    setAddError("")
    showToast(`Added ${value}.`)
  }

  function startEdit(c: Category) {
    setEditingId(c.id)
    setDraft(c.name)
    setEditError("")
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError("")
  }

  function saveEdit(c: Category) {
    const value = draft.trim()
    if (!value) {
      setEditError("Enter a category name.")
      return
    }
    if (nameTaken(value, c.id)) {
      setEditError(`${value} is already a category.`)
      return
    }
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: value } : x)))
    setEditingId(null)
    setEditError("")
    if (value !== c.name) showToast(`Renamed ${c.name} to ${value}.`)
  }

  function toggleExempt(c: Category) {
    const exempt = !c.receiptExempt
    setCategories((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, receiptExempt: exempt } : x)),
    )
    showToast(
      exempt ? `${c.name} is now logged without a receipt.` : `${c.name} now needs a receipt.`,
    )
  }

  function removeCategory(c: Category) {
    setCategories((prev) => prev.filter((x) => x.id !== c.id))
    if (editingId === c.id) cancelEdit()
    showToast(`Removed ${c.name}.`)
  }

  async function saveRules(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await api.saveReconciliationRules({ batchWindowDays: Number(batchWindow) })
      showToast(`Batching window set to ${batchWindow} day${batchWindow === "1" ? "" : "s"}.`)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "The rules did not save. Try again.")
    }
  }

  return (
    <>
      <div className="mt-6" data-rise>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Settings</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Branches, the POS connection, and how deposits are reconciled.
        </p>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Branches */}
        <SettingCard
        icon={StorefrontIcon}
        title="Branches"
        subtitle="Stores audited in TWZ Manager. Sales are pulled from Loyverse per branch."
      >
        <ul className="divide-y divide-line rounded-lg border border-line">
          {stores.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[14px] font-medium text-ink-soft">{s.name}</span>
              <span className="inline-flex items-center gap-1 text-[12px] text-mute">
                <CheckCircleIcon size={13} weight="fill" className="text-sage-ink" aria-hidden="true" />
                Loyverse-linked
              </span>
            </li>
          ))}
        </ul>
      </SettingCard>

      {/* Loyverse POS integration */}
      <SettingCard
        icon={PlugsConnectedIcon}
        title="Loyverse POS"
        subtitle="The source of truth for daily sales in every branch."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
          <div>
            {pos.data?.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink">
                <CheckCircleIcon size={12} weight="fill" aria-hidden="true" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-claret/10 px-2 py-0.5 text-[11px] font-medium text-claret">
                {pos.loading ? "Checking…" : "Not connected"}
              </span>
            )}
            <p className="mt-1.5 text-[12.5px] text-mute">
              {pos.error
                ? "The connection status could not load."
                : `${pos.data?.storesLinked ?? 0} of ${stores.length} branches synced · token ending ${pos.data?.tokenHint ?? "—"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              api
                .reconnectPos()
                .then(() => {
                  pos.reload()
                  showToast("Loyverse connection refreshed.")
                })
                .catch((err: unknown) => {
                  showToast(
                    err instanceof ApiError ? err.message : "The reconnect did not go through.",
                  )
                })
            }}
            className="flex h-10 items-center justify-center rounded-lg border border-line-strong px-4 text-[13.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
          >
            Reconnect
          </button>
        </div>
      </SettingCard>

      {/* Expense categories */}
      <SettingCard
        icon={TagIcon}
        title="Expense categories"
        subtitle="What managers pick from when logging an expense, and which of them need a receipt."
      >
        <ul className="divide-y divide-line rounded-lg border border-line">
          {categories.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-mute">
              No categories left. Managers cannot log an expense until there is at least one.
            </li>
          )}
          {categories.map((c) => (
            <li key={c.id} className="px-4 py-2.5">
              {editingId === c.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    aria-label={`Rename ${c.name}`}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      setEditError("")
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        saveEdit(c)
                      }
                      if (e.key === "Escape") cancelEdit()
                    }}
                    aria-invalid={Boolean(editError)}
                    className={`${inputFlush} ${editError ? inputBad : inputOk} w-full`}
                  />
                  {editError && (
                    <p role="alert" className="mt-1.5 text-[13px] text-claret">
                      {editError}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(c)}
                      className="flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-[13.5px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex h-10 items-center justify-center rounded-lg border border-line-strong px-4 text-[13.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[14px] font-medium text-ink-soft">
                    {c.name}
                  </span>
                  <RowMenu
                    label={`Actions for ${c.name}`}
                    items={[
                      { label: "Rename", onSelect: () => startEdit(c) },
                      { label: "Delete", tone: "danger", onSelect: () => removeCategory(c) },
                    ]}
                  />
                </div>
              )}

              {/* The receipt rule travels with the category, so it is set here
                  rather than baked into a fixed pair of names */}
              <label className="-my-1 flex w-fit cursor-pointer items-center gap-2 py-1 text-[12.5px] text-mute">
                <input
                  type="checkbox"
                  checked={c.receiptExempt}
                  onChange={() => toggleExempt(c)}
                  className="h-4 w-4 rounded accent-brand-deep"
                />
                Logged without a receipt
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-mute">
          Ticked categories are company-covered — the manager logs them with no proof attached, the
          way meals and merienda work. Everything else requires a receipt photo.
        </p>

        <form onSubmit={addCategory} className="mt-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="New category"
              placeholder="Add a category"
              value={newCategory}
              onChange={(e) => {
                setNewCategory(e.target.value)
                setAddError("")
              }}
              aria-invalid={Boolean(addError)}
              className={`${inputFlush} ${addError ? inputBad : inputOk} min-w-0 flex-1`}
            />
            <button
              type="submit"
              className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-4 text-[14px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
            >
              <PlusIcon size={15} weight="bold" aria-hidden="true" />
              Add
            </button>
          </div>
          {addError && (
            <p role="alert" className="mt-1.5 text-[13px] text-claret">
              {addError}
            </p>
          )}
        </form>
      </SettingCard>

      {/* Reconciliation rules */}
      <SettingCard
        icon={ShieldCheckIcon}
        title="Reconciliation"
        subtitle="How the app matches bank deposits against expected amounts."
      >
        <div className="flex items-start justify-between gap-3 rounded-lg border border-line px-4 py-3">
          <div>
            <p className="text-[14px] font-medium text-ink-soft">
              Require a discrepancy form on mismatch
            </p>
            <p className="mt-0.5 text-[12.5px] text-mute">
              A mismatched deposit can never be closed silently — the reason and a receipt are always
              required.
            </p>
          </div>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink">
            <CheckCircleIcon size={12} weight="fill" aria-hidden="true" />
            Always on
          </span>
        </div>

        <form onSubmit={saveRules} className="mt-4">
          <label htmlFor="batch-window" className="text-[13px] font-medium text-ink-soft">
            Deposit batching window (days)
          </label>
          <p className="mt-0.5 text-[12.5px] text-mute">
            How many audited days a single bank deposit may cover before one is expected.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="batch-window"
              type="number"
              min={1}
              max={14}
              inputMode="numeric"
              value={batchWindow}
              onChange={(e) => setBatchWindow(e.target.value)}
              className={`${inputFlush} ${inputOk} w-24`}
            />
            <button
              type="submit"
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-[14.5px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985]"
            >
              Save
            </button>
          </div>
        </form>
        </SettingCard>
      </div>
    </>
  )
}
