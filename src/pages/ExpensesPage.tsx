import { useState } from "react"
import type { CSSProperties, SubmitEvent } from "react"
import {
  BowlFoodIcon,
  CaretDownIcon,
  CoffeeIcon,
  DropIcon,
  LightningIcon,
  PackageIcon,
  StorefrontIcon,
  WifiHighIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { peso, rowDate } from "../lib/format"
import { STORES, expenseItemsFor } from "../lib/mock"
import type { ExpenseCategory, ExpenseItem } from "../lib/mock"
import {
  FilterSelect,
  FormField,
  PhotoAttach,
  inputBad,
  inputBase,
  inputOk,
} from "../components/ui"

const CATEGORY_ICON: Record<ExpenseCategory, Icon> = {
  Meals: BowlFoodIcon,
  Merienda: CoffeeIcon,
  "Water bill": DropIcon,
  "Electric bill": LightningIcon,
  "Wifi bill": WifiHighIcon,
  Other: PackageIcon,
}

const CATEGORIES: ExpenseCategory[] = [
  "Meals",
  "Merienda",
  "Water bill",
  "Electric bill",
  "Wifi bill",
  "Other",
]

const NOTE_PLACEHOLDER: Record<ExpenseCategory, string> = {
  Meals: "e.g. Staff lunch",
  Merienda: "e.g. Afternoon merienda",
  "Water bill": "e.g. June billing period",
  "Electric bill": "e.g. June billing period, meter reading",
  "Wifi bill": "e.g. June billing period, account number",
  Other: "e.g. Tricycle fare, parts pickup",
}

const DEFAULT_NOTE: Record<ExpenseCategory, string> = {
  Meals: "Staff meal",
  Merienda: "Afternoon merienda",
  "Water bill": "Water bill",
  "Electric bill": "Electric bill",
  "Wifi bill": "Wifi bill",
  Other: "Other expense",
}

type FieldErrors = { amount?: string; note?: string; receipt?: string }

function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function ExpenseRow({ item }: { item: ExpenseItem }) {
  const RowIcon = CATEGORY_ICON[item.category]
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage text-sage-ink">
        <RowIcon size={17} weight="bold" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink-soft">{item.note}</span>
        <span className="block text-[12px] text-mute">
          {item.category} · {item.time}
        </span>
      </span>
      <span className="text-[14px] font-semibold tabular-nums text-ink">
        {peso.format(item.amount)}
      </span>
    </li>
  )
}

export default function ExpensesPage() {
  const [storeId, setStoreId] = useState("arevalo")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("Meals")
  const [note, setNote] = useState("")
  const [receipt, setReceipt] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)
  const [added, setAdded] = useState<Record<string, ExpenseItem[]>>({})

  const today = new Date()
  const yesterday = addDays(today, -1)
  const todayItems = [...(added[storeId] ?? []), ...expenseItemsFor(storeId, today)]
  const yesterdayItems = expenseItemsFor(storeId, yesterday)

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const value = Number(amount.replace(/,/g, ""))
    if (!amount.trim()) next.amount = "Enter the amount."
    else if (!Number.isFinite(value) || value <= 0) next.amount = "Enter an amount above zero."
    if (category === "Other" && !note.trim())
      next.note = "Describe the expense so the owner knows what it was for."
    if (!receipt) next.receipt = "A receipt photo is required for every expense."
    return next
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    // TODO: send to the real API once the backend exists
    await new Promise((r) => setTimeout(r, 600))
    const item: ExpenseItem = {
      id: `local-${Date.now().toString(36)}`,
      category,
      note: note.trim() || DEFAULT_NOTE[category],
      amount: Math.round(Number(amount.replace(/,/g, ""))),
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    }
    setAdded((prev) => ({ ...prev, [storeId]: [item, ...(prev[storeId] ?? [])] }))
    setAmount("")
    setNote("")
    setReceipt(null)
    setSaving(false)
    setSavedMessage(true)
    window.setTimeout(() => setSavedMessage(false), 3000)
  }

  const todayTotal = todayItems.reduce((sum, i) => sum + i.amount, 0)
  const yesterdayTotal = yesterdayItems.reduce((sum, i) => sum + i.amount, 0)

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
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Log expense */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface p-5 sm:p-6"
          style={{ "--index": 1 } as CSSProperties}
        >
        <h2 className="text-[15px] font-semibold text-ink">Log an expense</h2>
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
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
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={errors.amount ? "expense-amount-error" : undefined}
                  className={`${inputBase} pl-8 ${errors.amount ? inputBad : inputOk}`}
                />
              </div>
            </FormField>
            <FormField id="expense-category" label="Category">
              <div className="relative">
                <select
                  id="expense-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className={`${inputBase} ${inputOk} appearance-none pr-9`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <CaretDownIcon
                  size={13}
                  weight="bold"
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 mt-1 -translate-y-1/2 text-mute"
                />
              </div>
            </FormField>
          </div>

          <FormField
            id="expense-note"
            label={category === "Other" ? "What was it for?" : "Note (optional)"}
            error={errors.note}
          >
            <input
              id="expense-note"
              type="text"
              placeholder={NOTE_PLACEHOLDER[category]}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={errors.note ? "expense-note-error" : undefined}
              className={`${inputBase} ${errors.note ? inputBad : inputOk}`}
            />
          </FormField>

          <PhotoAttach
            id="expense-receipt"
            label="Receipt photo"
            hint="Take a photo or choose from the gallery"
            file={receipt}
            onChange={(f) => setReceipt(f)}
            error={errors.receipt}
          />

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? "Saving" : "Save expense"}
            </button>
            {savedMessage && (
              <p role="status" className="text-[13px] font-medium text-sage-ink">
                Expense saved.
              </p>
            )}
          </div>
        </form>
      </section>

        {/* Recent expenses */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface"
          style={{ "--index": 2 } as CSSProperties}
        >
        <div className="flex items-baseline justify-between px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">Today</h2>
          <p className="text-[13px] font-medium tabular-nums text-mute">{peso.format(todayTotal)}</p>
        </div>
        {todayItems.length === 0 ? (
          <p className="px-5 pb-6 pt-2 text-[13.5px] text-mute">No expenses logged yet today.</p>
        ) : (
          <ul className="divide-y divide-line">
            {todayItems.map((item) => (
              <ExpenseRow key={item.id} item={item} />
            ))}
          </ul>
        )}

        <div className="flex items-baseline justify-between border-t border-line px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">{rowDate(yesterday)}</h2>
          <p className="text-[13px] font-medium tabular-nums text-mute">
            {peso.format(yesterdayTotal)}
          </p>
        </div>
        <ul className="divide-y divide-line">
          {yesterdayItems.map((item) => (
            <ExpenseRow key={item.id} item={item} />
          ))}
        </ul>
        </section>
      </div>
    </>
  )
}
