import { useEffect, useRef, useState } from "react"
import type { SubmitEvent } from "react"
import { createPortal } from "react-dom"
import { XIcon } from "@phosphor-icons/react"
import { useSheetEnter } from "../lib/motion"
import type { ExpenseCategoryConfig, ExpenseItem, ExpensePatch } from "../lib/api"
import { defaultNote, notePlaceholder } from "../lib/expenseCategories"
import { FormField, inputBad, inputBase, inputOk } from "./ui"
import { Select } from "./Select"
import { ReceiptUploader } from "./ReceiptUploader"
import { storedEntries } from "../lib/receipts"
import type { ReceiptEntry } from "../lib/receipts"

type FieldErrors = { amount?: string; receipt?: string }

/*
 * Corrects one already-logged expense. Mount with a `key` of the item's id so
 * the fields re-seed each time a different row is opened.
 *
 * Receipts already on file show as real tiles served from their stored URLs,
 * removable and addable up to five — but a required category can never be
 * saved with none: the receipt is the evidence behind a deduction from the
 * expected deposit, so switching a meal into a category that needs proof
 * demands one. Which categories exist, and which need proof, is the server's
 * answer — the page passes it in.
 */
export function ExpenseDialog({
  item,
  categories,
  dayLabel,
  onSave,
  onClose,
}: {
  item: ExpenseItem | null
  categories: ExpenseCategoryConfig[]
  dayLabel: string
  /** The row being corrected and the patch to send for it */
  onSave: (item: ExpenseItem, patch: ExpensePatch) => void
  onClose: () => void
}) {
  const [amount, setAmount] = useState(() => (item ? String(item.amount) : ""))
  const [category, setCategory] = useState(item?.category ?? "")
  const [note, setNote] = useState(item?.note ?? "")
  const [receipts, setReceipts] = useState<ReceiptEntry[]>(() =>
    item ? storedEntries(item.receiptUrls) : [],
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const backdropRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useSheetEnter(panelRef, backdropRef, item)

  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [item, onClose])

  if (!item) return null

  const current = item
  /* The item's own category may have been deleted in Settings since it was
     logged — keep it selectable so an untouched edit still saves */
  const options = categories.some((c) => c.name === category)
    ? categories.map((c) => c.name)
    : [category, ...categories.map((c) => c.name)]
  const receiptOptional = categories.find((c) => c.name === category)?.receiptExempt ?? false

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: FieldErrors = {}
    const value = Number(amount.replace(/,/g, ""))
    if (!amount.trim()) next.amount = "Enter the amount."
    else if (!Number.isFinite(value) || value <= 0) next.amount = "Enter an amount above zero."
    if (!receiptOptional && receipts.length === 0)
      next.receipt = `At least one receipt photo is required for ${category.toLowerCase()}.`
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const keep = receipts.map((r) => r.url).filter((u): u is string => u !== null)
    const add = receipts.map((r) => r.file).filter((f): f is File => f !== null)
    const photosChanged = add.length > 0 || keep.length !== current.receiptUrls.length
    onSave(current, {
      category,
      note: note.trim() || defaultNote(category),
      // To the centavo, never to the peso — the slip the owner checks carries centavos
      amount: Math.round(value * 100) / 100,
      ...(photosChanged ? { receipts: { keep, add } } : {}),
    })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit expense"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
    >
      <button
        ref={backdropRef}
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/25"
      />

      <div
        ref={panelRef}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-xl sm:border sm:pb-5 sm:shadow-[0_8px_28px_rgba(21,22,19,0.14)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Edit expense</h2>
            <p className="mt-0.5 text-[13px] text-mute">{dayLabel} · not yet deposited</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
          >
            <XIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="edit-amount" label="Amount" error={errors.amount}>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 mt-1 -translate-y-1/2 text-[15px] text-mute"
                >
                  ₱
                </span>
                <input
                  id="edit-amount"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={errors.amount ? "edit-amount-error" : undefined}
                  className={`${inputBase} pl-8 ${errors.amount ? inputBad : inputOk}`}
                />
              </div>
            </FormField>
            <FormField id="edit-category" label="Category">
              <div className="mt-2">
                <Select
                  id="edit-category"
                  ariaLabel="Category"
                  value={category}
                  onChange={setCategory}
                  options={options.map((c) => ({ value: c, label: c }))}
                />
              </div>
            </FormField>
          </div>

          <FormField id="edit-note" label="Note (optional)">
            <input
              id="edit-note"
              type="text"
              placeholder={notePlaceholder(category)}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputBase} ${inputOk}`}
            />
          </FormField>

          <ReceiptUploader
            inputId="edit-receipt"
            label={receiptOptional ? "Receipts (optional)" : "Receipts"}
            hint={
              receiptOptional
                ? "Not required for company-covered categories"
                : "Up to 5 photos — remove or add as needed"
            }
            entries={receipts}
            onChange={setReceipts}
            error={errors.receipt}
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 items-center justify-center rounded-lg px-4 text-[14.5px] font-medium text-ink-soft transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-[14.5px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985]"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
