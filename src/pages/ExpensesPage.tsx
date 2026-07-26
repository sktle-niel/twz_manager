import { useState } from "react"
import type { CSSProperties, SubmitEvent } from "react"
import { PaperclipIcon, PlusIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react"
import { peso, rowDate, shortDate } from "../lib/format"
import { dayKey, expenseItemsFor, pendingDepositDays } from "../lib/mock"
import { useSession } from "../lib/session"
import type { ExpenseCategory, ExpenseItem } from "../lib/mock"
import {
  CATEGORIES,
  CATEGORY_ICON,
  DEFAULT_NOTE,
  NOTE_PLACEHOLDER,
  RECEIPT_OPTIONAL,
} from "../lib/expenseCategories"
import { BranchTag, FormField, inputBad, inputBase, inputOk } from "../components/ui"
import { Select } from "../components/Select"
import { ReceiptUploader } from "../components/ReceiptUploader"
import type { ReceiptEntry } from "../lib/receipts"
import { RowMenu } from "../components/RowMenu"
import { ExpenseDialog } from "../components/ExpenseDialog"
import { Toast } from "../components/Toast"

type FieldErrors = { amount?: string; receipt?: string }

/* An expense queued in the form but not yet sent */
type DraftLine = {
  id: string
  category: ExpenseCategory
  note: string
  amount: number
  time: string
  receipts: File[]
}

/*
 * Corrections layered over one day. The day's expenses come from two places —
 * rows this session logged, and rows the mock already had — so edits and
 * deletes are keyed by item id and applied to both alike, rather than only
 * being possible on the ones we happen to hold in state.
 */
type DayEdits = {
  added: ExpenseItem[]
  removed: string[]
  edited: Record<string, ExpenseItem>
}

const NO_EDITS: DayEdits = { added: [], removed: [], edited: {} }

function ExpenseRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ExpenseItem
  onEdit: () => void
  onDelete: () => void
}) {
  const RowIcon = CATEGORY_ICON[item.category]
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage text-sage-ink">
        <RowIcon size={17} weight="bold" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink-soft">{item.note}</span>
        <span className="flex items-center gap-1 text-[12px] text-mute">
          <span className="truncate">
            {item.category} · {item.time}
          </span>
          {item.receiptCount > 0 && (
            <span className="flex shrink-0 items-center gap-0.5">
              <PaperclipIcon size={12} weight="bold" aria-hidden="true" />
              {item.receiptCount > 1 && <span className="tabular-nums">{item.receiptCount}</span>}
              <span className="sr-only">
                {item.receiptCount} {item.receiptCount === 1 ? "receipt" : "receipts"} attached
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

export default function ExpensesPage() {
  const { store } = useSession()
  const storeId = store.id
  const [dayValue, setDayValue] = useState(() => dayKey(new Date()))
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("Meals")
  const [note, setNote] = useState("")
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [draft, setDraft] = useState<DraftLine[]>([])
  const [saving, setSaving] = useState(false)
  const [dayEdits, setDayEdits] = useState<Record<string, DayEdits>>({})
  const [editing, setEditing] = useState<ExpenseItem | null>(null)
  /* Keyed by id so repeating the same message replays the toast animation */
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)

  const showToast = (message: string) => setToast({ id: Date.now(), message })

  const today = new Date()
  const todayKey = dayKey(today)

  /*
   * A day can still take expenses until its deposit is recorded — once a day is
   * reconciled, changing its expenses would move an expected deposit that has
   * already been matched. Today plus the days still awaiting a deposit, newest
   * first; the same source the Deposits page reads.
   */
  const eligibleDays = [today, ...pendingDepositDays(storeId, today).slice().reverse()]

  // Falls back to today when a branch switch makes the chosen day ineligible
  const selectedDay = eligibleDays.find((d) => dayKey(d) === dayValue) ?? eligibleDays[0]
  const selectedKey = dayKey(selectedDay)
  const isToday = selectedKey === todayKey

  const bucket = (d: Date) => `${storeId}:${dayKey(d)}`
  const dayLabel = (d: Date) => (dayKey(d) === todayKey ? `Today, ${shortDate(d)}` : rowDate(d))

  function itemsFor(d: Date): ExpenseItem[] {
    const edits = dayEdits[bucket(d)] ?? NO_EDITS
    return [...edits.added, ...expenseItemsFor(storeId, d)]
      .filter((i) => !edits.removed.includes(i.id))
      .map((i) => edits.edited[i.id] ?? i)
  }
  const totalFor = (d: Date) => itemsFor(d).reduce((sum, i) => sum + i.amount, 0)

  function patchDay(d: Date, patch: (edits: DayEdits) => DayEdits) {
    const key = bucket(d)
    setDayEdits((prev) => ({ ...prev, [key]: patch(prev[key] ?? NO_EDITS) }))
  }

  const items = itemsFor(selectedDay)
  const selectedTotal = items.reduce((sum, i) => sum + i.amount, 0)

  const receiptOptional = RECEIPT_OPTIONAL.includes(category)
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
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return null
    return {
      id: `line-${Date.now().toString(36)}-${draft.length}`,
      category,
      note: note.trim() || DEFAULT_NOTE[category],
      amount: Math.round(Number(amount.replace(/,/g, ""))),
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
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
    // TODO: one batch call to the real API once the backend exists
    await new Promise((r) => setTimeout(r, 700))
    const saved: ExpenseItem[] = lines.map((l) => ({
      id: l.id,
      category: l.category,
      note: l.note,
      amount: l.amount,
      time: l.time,
      receiptCount: l.receipts.length,
      receipts: l.receipts.length > 0 ? l.receipts : undefined,
    }))
    patchDay(selectedDay, (edits) => ({ ...edits, added: [...saved, ...edits.added] }))
    setDraft([])
    clearFields()
    setSaving(false)
    showToast(
      `${saved.length} ${saved.length === 1 ? "expense" : "expenses"} saved to ${
        isToday ? "today" : shortDate(selectedDay)
      }.`,
    )
  }

  function deleteItem(item: ExpenseItem) {
    patchDay(selectedDay, (edits) => ({ ...edits, removed: [...edits.removed, item.id] }))
    showToast(`Deleted ${item.note}.`)
  }

  function saveEdit(updated: ExpenseItem) {
    patchDay(selectedDay, (edits) => ({
      ...edits,
      edited: { ...edits.edited, [updated.id]: updated },
    }))
    setEditing(null)
    showToast(`Updated ${updated.note}.`)
  }

  const saveLabel = saving
    ? "Saving"
    : queuedCount === 0
      ? "Save expenses"
      : `Save ${queuedCount} ${queuedCount === 1 ? "expense" : "expenses"}`

  return (
    <>
      <div
        className="anim-rise mt-6 flex flex-wrap items-center justify-between gap-3"
        style={{ "--index": 0 } as CSSProperties}
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
          className="anim-rise rounded-xl border border-line bg-surface p-5 sm:p-6"
          style={{ "--index": 1 } as CSSProperties}
        >
          <h2 className="text-[15px] font-semibold text-ink">Log expenses</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            Add each one, then save the whole day in a single go.
          </p>

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
                    onChange={(v) => setCategory(v as ExpenseCategory)}
                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                </div>
              </FormField>
            </div>

            <FormField id="expense-note" label="Note (optional)">
              <input
                id="expense-note"
                type="text"
                enterKeyHint="done"
                placeholder={NOTE_PLACEHOLDER[category]}
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
                  ? "Not required for staff meals and merienda"
                  : "Add up to 5 — camera or gallery"
              }
              entries={receipts}
              onChange={setReceipts}
              error={receiptOptional ? undefined : errors.receipt}
            />

            <button
              type="submit"
              disabled={saving}
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
                  const LineIcon = CATEGORY_ICON[line.category]
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
              onClick={handleSaveAll}
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
          className="anim-rise rounded-xl border border-line bg-surface"
          style={{ "--index": 2 } as CSSProperties}
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
          {items.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-[13.5px] text-mute">
              No expenses logged for this day yet.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {items.map((item) => (
                <ExpenseRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditing(item)}
                  onDelete={() => deleteItem(item)}
                />
              ))}
            </ul>
          )}

          <div className="border-t border-line px-5 pb-1 pt-4">
            <h2 className="text-[15px] font-semibold text-ink">Not yet deposited</h2>
            <p className="mt-0.5 text-[13px] text-mute">
              Expenses can still be added to these days. Days with nothing logged are flagged — pick
              one to log against it.
            </p>
          </div>
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
        </section>
      </div>

      <ExpenseDialog
        key={editing?.id}
        item={editing}
        dayLabel={dayLabel(selectedDay)}
        onSave={saveEdit}
        onClose={() => setEditing(null)}
      />

      <Toast
        key={toast?.id}
        message={toast?.message ?? ""}
        onDismiss={() => setToast(null)}
      />
    </>
  )
}
