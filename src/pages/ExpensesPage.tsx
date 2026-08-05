import { useState } from "react"
import type { SubmitEvent } from "react"
import { PaperclipIcon, PlusIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react"
import { clockLabel, peso, rowDate, shortDate } from "../lib/format"
import { dayKey, fromDayKey } from "../lib/dateRange"
import { ApiError, api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useManagerSession } from "../lib/session"
import type { ExpenseItem, ExpensePatch } from "../lib/api"
import { categoryIcon, defaultNote, notePlaceholder } from "../lib/expenseCategories"
import { BranchTag, FormField, inputBad, inputBase, inputOk } from "../components/ui"
import { Select } from "../components/Select"
import { ReceiptUploader } from "../components/ReceiptUploader"
import type { ReceiptEntry } from "../lib/receipts"
import { RowMenu } from "../components/RowMenu"
import { ExpenseDialog } from "../components/ExpenseDialog"
import { useToast } from "../lib/toast"

type FieldErrors = { amount?: string; receipt?: string }

/* An expense queued in the form but not yet sent */
type DraftLine = {
  id: string
  category: string
  note: string
  amount: number
  timeLabel: string
  receipts: File[]
}

/*
 * Corrections used to be layered over the day in page state, because the rows
 * came from two places — ones this session logged and ones already on file.
 * They are one place now: every add, edit and delete goes to the API and the
 * day is re-read, so a correction survives navigating away.
 */

function ExpenseRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ExpenseItem
  onEdit: () => void
  onDelete: () => void
}) {
  const RowIcon = categoryIcon(item.category)
  const receiptCount = item.receiptUrls.length
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage text-sage-ink">
        <RowIcon size={17} weight="bold" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink-soft">{item.note}</span>
        <span className="flex items-center gap-1 text-[12px] text-mute">
          <span className="truncate">
            {item.category} · {clockLabel(new Date(item.at))}
          </span>
          {receiptCount > 0 && (
            <span className="flex shrink-0 items-center gap-0.5">
              <PaperclipIcon size={12} weight="bold" aria-hidden="true" />
              {receiptCount > 1 && <span className="tabular-nums">{receiptCount}</span>}
              <span className="sr-only">
                {receiptCount} {receiptCount === 1 ? "receipt" : "receipts"} attached
              </span>
            </span>
          )}
        </span>
      </span>
      <span className="text-[14px] font-semibold tabular-nums text-ink">
        {peso.format(item.amount)}
      </span>
      <RowMenu
        label={`Actions for ${item.note}`}
        items={[
          { label: "Edit", onSelect: onEdit },
          { label: "Delete", onSelect: onDelete, tone: "danger" },
        ]}
      />
    </li>
  )
}

/** One retry line for a read that failed — the sample-data era never needed one */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 px-5 pb-4 pt-2 text-[13px] text-claret">
      {message}
      <button type="button" onClick={onRetry} className="font-medium underline underline-offset-4">
        Try again
      </button>
    </p>
  )
}

export default function ExpensesPage() {
  const { store } = useManagerSession()
  const { showToast } = useToast()
  const storeId = store.id
  const [dayValue, setDayValue] = useState(() => dayKey(new Date()))
  const [amount, setAmount] = useState("")
  const [pickedCategory, setPickedCategory] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [draft, setDraft] = useState<DraftLine[]>([])
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ExpenseItem | null>(null)

  const today = new Date()
  const todayKey = dayKey(today)

  /* What managers may pick from is the server's list — the owner edits it */
  const categoriesApi = useApi(() => api.expenseCategories(), [])
  const categories = categoriesApi.data ?? []
  const category = pickedCategory ?? categories[0]?.name ?? ""

  /*
   * A day can still take expenses until its deposit is recorded — once a day is
   * reconciled, changing its expenses would move an expected deposit that has
   * already been matched. Today plus the days still awaiting a deposit, newest
   * first; the same source the Deposits page reads.
   */
  const pending = useApi(() => api.pendingDeposits(storeId), [storeId])
  const eligibleKeys = [todayKey, ...[...(pending.data ?? [])].reverse().map((a) => a.day)]

  // Falls back to today when a branch switch makes the chosen day ineligible
  const selectedKey = eligibleKeys.includes(dayValue) ? dayValue : todayKey
  const selectedDay = fromDayKey(selectedKey)
  const isToday = selectedKey === todayKey
  const eligibleDays = eligibleKeys.map(fromDayKey)

  /* Every eligible day in one request rather than a call per row */
  const oldestKey = eligibleKeys[eligibleKeys.length - 1] ?? todayKey
  const expenses = useApi(
    () => api.expenses(storeId, { from: oldestKey, to: todayKey }),
    [storeId, oldestKey, todayKey],
  )

  const byDay = new Map<string, ExpenseItem[]>()
  for (const item of expenses.data ?? []) {
    byDay.set(item.day, [...(byDay.get(item.day) ?? []), item])
  }

  const dayLabel = (d: Date) => (dayKey(d) === todayKey ? `Today, ${shortDate(d)}` : rowDate(d))
  const itemsFor = (d: Date): ExpenseItem[] => byDay.get(dayKey(d)) ?? []
  const totalFor = (d: Date) => itemsFor(d).reduce((sum, i) => sum + i.amount, 0)

  const items = itemsFor(selectedDay)
  const selectedTotal = items.reduce((sum, i) => sum + i.amount, 0)

  const receiptOptional = categories.find((c) => c.name === category)?.receiptExempt ?? false
  const draftTotal = draft.reduce((sum, l) => sum + l.amount, 0)
  const formFilled = amount.trim() !== ""
  const queuedCount = draft.length + (formFilled ? 1 : 0)

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const value = Number(amount.replace(/,/g, ""))
    if (!amount.trim()) next.amount = "Enter the amount."
    else if (!Number.isFinite(value) || value <= 0) next.amount = "Enter an amount above zero."
    if (!receiptOptional && receipts.length === 0)
      next.receipt = `At least one receipt photo is required for ${category.toLowerCase()}.`
    return next
  }

  function buildLine(): DraftLine | null {
    if (!category) return null
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return null
    return {
      id: `line-${Date.now().toString(36)}-${draft.length}`,
      category,
      note: note.trim() || defaultNote(category),
      // To the centavo, never to the peso — receipts carry centavos
      amount: Math.round(Number(amount.replace(/,/g, "")) * 100) / 100,
      timeLabel: clockLabel(new Date()),
      receipts: receipts.map((r) => r.file).filter((f): f is File => f !== null),
    }
  }

  /* Category is kept — the next line is usually a different one, but retyping
     the amount is the slow part, not reselecting the category */
  function clearFields() {
    setAmount("")
    setNote("")
    setReceipts([])
    setErrors({})
  }

  /* Enter in any field queues another line, so a whole evening's spend can be
     typed without touching the mouse */
  function handleAdd(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const line = buildLine()
    if (!line) return
    setDraft((prev) => [...prev, line])
    clearFields()
  }

  async function handleSaveAll() {
    // A filled-but-not-added form still counts, so nothing typed is lost
    let lines = draft
    if (formFilled) {
      const line = buildLine()
      if (!line) return
      lines = [...draft, line]
    }
    if (lines.length === 0) return

    setSaving(true)
    try {
      // One batch call — the whole evening's spend is a single write
      await api.addExpenses(
        lines.map((l) => ({
          storeId,
          day: selectedKey,
          category: l.category,
          note: l.note,
          amount: l.amount,
          receipts: l.receipts,
        })),
      )
      expenses.reload()
      setDraft([])
      clearFields()
      showToast(
        `${lines.length} ${lines.length === 1 ? "expense" : "expenses"} saved to ${
          isToday ? "today" : shortDate(selectedDay)
        }.`,
      )
    } catch (err) {
      // The draft stays — nothing typed is lost to a dropped connection
      showToast(err instanceof ApiError ? err.message : "Saving failed. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(item: ExpenseItem) {
    try {
      await api.deleteExpense(item.id)
      expenses.reload()
      showToast(`Deleted ${item.note}.`)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Deleting failed. Try again.")
    }
  }

  async function saveEdit(item: ExpenseItem, patch: ExpensePatch) {
    try {
      await api.updateExpense(item.id, patch)
      expenses.reload()
      setEditing(null)
      showToast(`Updated ${patch.note ?? item.note}.`)
    } catch (err) {
      setEditing(null)
      showToast(err instanceof ApiError ? err.message : "The change did not save. Try again.")
    }
  }

  const saveLabel = saving
    ? "Saving"
    : queuedCount === 0
      ? "Save expenses"
      : `Save ${queuedCount} ${queuedCount === 1 ? "expense" : "expenses"}`

  return (
    <>
      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-3"
        data-rise
      >
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Expenses</h1>
          <p className="mt-0.5 text-[13px] text-mute">
            Logged expenses are deducted from the expected deposit.
          </p>
        </div>
        <BranchTag name={store.name} />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Log expenses */}
        <section
          className="rounded-xl border border-line bg-surface p-5 sm:p-6"
          data-rise
        >
          <h2 className="text-[15px] font-semibold text-ink">Log expenses</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            Add each one, then save the whole day in a single go.
          </p>

          {categoriesApi.error && (
            <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-claret">
              The categories could not load, so nothing can be logged yet.
              <button
                type="button"
                onClick={categoriesApi.reload}
                className="font-medium underline underline-offset-4"
              >
                Try again
              </button>
            </p>
          )}

          <form onSubmit={handleAdd} noValidate className="mt-4 space-y-4">
            <FormField
              id="expense-date"
              label="Date"
              hint="Only days that have not been deposited yet can still be edited."
            >
              <div className="mt-2">
                <Select
                  id="expense-date"
                  ariaLabel="Date"
                  value={selectedKey}
                  onChange={setDayValue}
                  options={eligibleDays.map((d) => ({ value: dayKey(d), label: dayLabel(d) }))}
                />
              </div>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="expense-amount" label="Amount" error={errors.amount}>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 mt-1 -translate-y-1/2 text-[15px] text-mute"
                  >
                    ₱
                  </span>
                  <input
                    id="expense-amount"
                    inputMode="decimal"
                    enterKeyHint="done"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-required="true"
                    aria-invalid={Boolean(errors.amount)}
                    aria-describedby={errors.amount ? "expense-amount-error" : undefined}
                    className={`${inputBase} pl-8 ${errors.amount ? inputBad : inputOk}`}
                  />
                </div>
              </FormField>
              <FormField id="expense-category" label="Category">
                <div className="mt-2">
                  <Select
                    id="expense-category"
                    ariaLabel="Category"
                    value={category}
                    onChange={setPickedCategory}
                    options={categories.map((c) => ({ value: c.name, label: c.name }))}
                  />
                </div>
              </FormField>
            </div>

            <FormField id="expense-note" label="Note (optional)">
              <input
                id="expense-note"
                type="text"
                enterKeyHint="done"
                placeholder={notePlaceholder(category)}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${inputBase} ${inputOk}`}
              />
            </FormField>

            <ReceiptUploader
              inputId="expense-receipt"
              label={receiptOptional ? "Receipts (optional)" : "Receipts"}
              hint={
                receiptOptional
                  ? "Not required for company-covered categories"
                  : "Add up to 5, camera or gallery"
              }
              entries={receipts}
              onChange={setReceipts}
              error={receiptOptional ? undefined : errors.receipt}
            />

            <button
              type="submit"
              disabled={saving || !category}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-[14.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03] disabled:pointer-events-none disabled:opacity-60"
            >
              <PlusIcon size={16} weight="bold" aria-hidden="true" />
              Add another expense
            </button>
          </form>

          {draft.length > 0 && (
            <div className="mt-4 rounded-lg border border-line">
              <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
                <h3 className="text-[13.5px] font-medium text-ink">
                  Ready to save · {dayLabel(selectedDay)}
                </h3>
                <span className="text-[13px] font-semibold tabular-nums text-ink">
                  {peso.format(draftTotal)}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {draft.map((line) => {
                  const LineIcon = categoryIcon(line.category)
                  return (
                    <li key={line.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage text-sage-ink">
                        <LineIcon size={15} weight="bold" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink-soft">
                          {line.note}
                        </span>
                        <span className="block truncate text-[12px] text-mute">
                          {line.category}
                          {line.receipts.length > 0 &&
                            ` · ${line.receipts.length} ${
                              line.receipts.length === 1 ? "receipt" : "receipts"
                            }`}
                        </span>
                      </span>
                      <span className="text-[13.5px] font-semibold tabular-nums text-ink">
                        {peso.format(line.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDraft((prev) => prev.filter((l) => l.id !== line.id))}
                        aria-label={`Remove ${line.note}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
                      >
                        <XIcon size={14} weight="bold" aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => void handleSaveAll()}
              disabled={saving || queuedCount === 0}
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40"
            >
              {saveLabel}
              {!saving && !isToday && queuedCount > 0 && ` to ${shortDate(selectedDay)}`}
            </button>
          </div>
        </section>

        {/* Expenses on the selected day, and the other days still open */}
        <section
          className="rounded-xl border border-line bg-surface"
          data-rise
        >
          <div className="px-5 pb-1 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">{dayLabel(selectedDay)}</h2>
              <p className="text-[13px] font-medium tabular-nums text-mute">
                {peso.format(selectedTotal)}
              </p>
            </div>
            <p className="mt-0.5 text-[13px] text-mute">
              Not deposited yet, so anything here can still be corrected or removed.
            </p>
          </div>
          {expenses.error ? (
            <LoadError
              message="The day's expenses could not load."
              onRetry={expenses.reload}
            />
          ) : items.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-[13.5px] text-mute">
              {expenses.loading ? "Loading…" : "No expenses logged for this day yet."}
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {items.map((item) => (
                <ExpenseRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditing(item)}
                  onDelete={() => void deleteItem(item)}
                />
              ))}
            </ul>
          )}

          <div className="border-t border-line px-5 pb-1 pt-4">
            <h2 className="text-[15px] font-semibold text-ink">Not yet deposited</h2>
            <p className="mt-0.5 text-[13px] text-mute">
              Expenses can still be added to these days. Days with nothing logged are flagged. Pick
              one to log against it.
            </p>
          </div>
          {pending.error ? (
            <LoadError message="The open days could not load." onRetry={pending.reload} />
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {eligibleDays.map((d) => {
                const active = dayKey(d) === selectedKey
                const total = totalFor(d)
                const missing = total === 0
                return (
                  <li key={dayKey(d)}>
                    <button
                      type="button"
                      onClick={() => setDayValue(dayKey(d))}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors duration-200 ease-quiet ${
                        active ? "bg-sage" : "hover:bg-black/[0.03]"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {missing && (
                          <>
                            <WarningCircleIcon
                              size={14}
                              weight="fill"
                              aria-hidden="true"
                              className="shrink-0 text-claret"
                            />
                            <span className="sr-only">Nothing logged.</span>
                          </>
                        )}
                        <span
                          className={`truncate text-[13.5px] ${
                            active ? "font-medium text-sage-ink" : "text-ink-soft"
                          }`}
                        >
                          {dayLabel(d)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-[13px] tabular-nums ${
                          missing
                            ? "font-medium text-claret"
                            : active
                              ? "font-medium text-sage-ink"
                              : "text-mute"
                        }`}
                      >
                        {missing ? "Nothing logged" : peso.format(total)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <ExpenseDialog
        key={editing?.id}
        item={editing}
        categories={categories}
        dayLabel={dayLabel(selectedDay)}
        onSave={(item, patch) => void saveEdit(item, patch)}
        onClose={() => setEditing(null)}
      />
    </>
  )
}
