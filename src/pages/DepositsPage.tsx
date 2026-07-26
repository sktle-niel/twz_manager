import { useState } from "react"
import type { CSSProperties, SubmitEvent } from "react"
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { peso, rowDate, shortDate } from "../lib/format"
import {
  DEPOSIT_TIMELINE,
  dayKey,
  expectedDepositFor,
  pendingDepositDays,
} from "../lib/mock"
import {
  BranchTag,
  FormField,
  PhotoAttach,
  inputBad,
  inputBase,
  inputOk,
} from "../components/ui"
import { useSession } from "../lib/session"

type FieldErrors = { amount?: string; reference?: string; days?: string; slip?: string }

/* Branches usually deposit at least this often; past it, the backlog is flagged */
const BATCH_WINDOW_DAYS = 3

type RecordedDeposit = {
  id: string
  dateLabel: string
  amount: number
  coversLabel: string
  matched: boolean
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function StatusChip({ matched }: { matched: boolean }) {
  return matched ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink">
      <CheckCircleIcon size={12} weight="fill" aria-hidden="true" />
      Matched
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-claret/10 px-2 py-0.5 text-[11px] font-medium text-claret">
      <WarningCircleIcon size={12} weight="fill" aria-hidden="true" />
      Discrepancy
    </span>
  )
}

export default function DepositsPage() {
  const { store } = useSession()
  const storeId = store.id
  const [checkedDays, setCheckedDays] = useState<Record<string, boolean>>({})
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [depositDate, setDepositDate] = useState(() => dayKey(new Date()))
  const [slip, setSlip] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)
  const [recordedByStore, setRecordedByStore] = useState<Record<string, RecordedDeposit[]>>({})
  const [clearedByStore, setClearedByStore] = useState<Record<string, string[]>>({})

  const today = new Date()

  // Every audited day not yet covered by a deposit, however far back it runs
  const pendingDays = pendingDepositDays(storeId, today).filter(
    (d) => !(clearedByStore[storeId] ?? []).includes(dayKey(d)),
  )
  const isChecked = (d: Date) => checkedDays[`${storeId}:${dayKey(d)}`] ?? true
  const selectedDays = pendingDays.filter(isChecked)
  const selectedTotal = selectedDays.reduce(
    (sum, d) => sum + expectedDepositFor(storeId, d),
    0,
  )

  // Mock history: one deposit covering two days, one that came up short
  const historyBase: RecordedDeposit[] = (() => {
    const [olderBack, newerBack] = DEPOSIT_TIMELINE.matchedPair
    const older = addDays(today, -olderBack)
    const newer = addDays(today, -newerBack)
    const short = addDays(today, -DEPOSIT_TIMELINE.shortDay)
    const matchedAmount = expectedDepositFor(storeId, newer) + expectedDepositFor(storeId, older)
    const shortAmount = expectedDepositFor(storeId, short) - DEPOSIT_TIMELINE.shortfall
    return [
      {
        id: `${storeId}-hist-1`,
        dateLabel: rowDate(newer),
        amount: matchedAmount,
        coversLabel: `Covers ${shortDate(older)} and ${shortDate(newer)}`,
        matched: true,
      },
      {
        id: `${storeId}-hist-2`,
        dateLabel: rowDate(short),
        amount: shortAmount,
        coversLabel: `Covers ${shortDate(short)}`,
        matched: false,
      },
    ]
  })()
  const recorded = [...(recordedByStore[storeId] ?? []), ...historyBase]

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const value = Number(amount.replace(/,/g, ""))
    if (!amount.trim()) next.amount = "Enter the amount deposited."
    else if (!Number.isFinite(value) || value <= 0) next.amount = "Enter an amount above zero."
    if (!reference.trim()) next.reference = "Enter the reference number from the bank."
    if (selectedDays.length === 0) next.days = "Select at least one day this deposit covers."
    if (!slip) next.slip = "The deposit slip photo is required."
    return next
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    // TODO: send to the real API once the backend exists
    await new Promise((r) => setTimeout(r, 700))
    const value = Math.round(Number(amount.replace(/,/g, "")))
    const covers =
      selectedDays.length === 1
        ? `Covers ${shortDate(selectedDays[0])}`
        : `Covers ${shortDate(selectedDays[0])} to ${shortDate(selectedDays[selectedDays.length - 1])}`
    setRecordedByStore((prev) => ({
      ...prev,
      [storeId]: [
        {
          id: `local-${Date.now().toString(36)}`,
          dateLabel: "Today",
          amount: value,
          coversLabel: covers,
          matched: value === selectedTotal,
        },
        ...(prev[storeId] ?? []),
      ],
    }))
    setClearedByStore((prev) => ({
      ...prev,
      [storeId]: [...(prev[storeId] ?? []), ...selectedDays.map((d) => dayKey(d))],
    }))
    setAmount("")
    setReference("")
    setSlip(null)
    setSaving(false)
    setSavedMessage(true)
    window.setTimeout(() => setSavedMessage(false), 3000)
  }

  const amountValue = Number(amount.replace(/,/g, ""))
  const showMatch = amount.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0 && selectedDays.length > 0
  const difference = amountValue - selectedTotal

  return (
    <>
      <div
        className="anim-rise mt-6 flex flex-wrap items-center justify-between gap-3"
        style={{ "--index": 0 } as CSSProperties}
      >
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Deposits</h1>
          <p className="mt-0.5 text-[13px] text-mute">
            Record each bank deposit and the audited days it covers.
          </p>
        </div>
        <BranchTag name={store.name} />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-5">
          {/* Days waiting for a deposit */}
          <section
            className="anim-rise rounded-xl border border-line bg-surface"
            style={{ "--index": 1 } as CSSProperties}
          >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">For deposit</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            Audited days not yet covered by a bank deposit.
          </p>
          {pendingDays.length > BATCH_WINDOW_DAYS && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-claret">
              <WarningCircleIcon size={15} weight="fill" aria-hidden="true" />
              {pendingDays.length} days waiting — deposits are usually made every{" "}
              {BATCH_WINDOW_DAYS} days.
            </p>
          )}
        </div>
        {pendingDays.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-[13.5px] text-mute">
            All audited days are covered. Today is still open and will show here once the day is
            closed.
          </p>
        ) : (
          <>
            <ul className="mt-1 divide-y divide-line">
              {pendingDays.map((d) => (
                <li key={dayKey(d)}>
                  <label className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked(d)}
                        onChange={(e) =>
                          setCheckedDays((prev) => ({
                            ...prev,
                            [`${storeId}:${dayKey(d)}`]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded accent-brand-deep"
                      />
                      <span className="text-[13.5px] font-medium text-ink-soft">{rowDate(d)}</span>
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums text-ink">
                      {peso.format(expectedDepositFor(storeId, d))}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <span className="text-[13px] text-mute">
                Selected total ({selectedDays.length} {selectedDays.length === 1 ? "day" : "days"})
              </span>
              <span className="text-[16px] font-semibold tabular-nums text-ink">
                {peso.format(selectedTotal)}
              </span>
            </div>
          </>
        )}
        {errors.days && (
          <p role="alert" className="border-t border-line px-5 py-3 text-[13px] text-claret">
            {errors.days}
          </p>
        )}
      </section>

          {/* Record the deposit */}
          <section
            className="anim-rise rounded-xl border border-line bg-surface p-5 sm:p-6"
            style={{ "--index": 2 } as CSSProperties}
          >
        <h2 className="text-[15px] font-semibold text-ink">Record a deposit</h2>
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="deposit-amount" label="Amount deposited" error={errors.amount}>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 mt-1 -translate-y-1/2 text-[15px] text-mute"
                >
                  ₱
                </span>
                <input
                  id="deposit-amount"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={errors.amount ? "deposit-amount-error" : undefined}
                  className={`${inputBase} pl-8 ${errors.amount ? inputBad : inputOk}`}
                />
              </div>
              {showMatch && (
                <p
                  role="status"
                  className={`mt-1.5 flex items-center gap-1.5 text-[13px] ${
                    difference === 0 ? "text-sage-ink" : "text-claret"
                  }`}
                >
                  {difference === 0 ? (
                    <>
                      <CheckCircleIcon size={15} weight="fill" aria-hidden="true" />
                      Matches the expected total for the selected days.
                    </>
                  ) : (
                    <>
                      <WarningCircleIcon size={15} weight="fill" aria-hidden="true" />
                      {peso.format(Math.abs(difference))} {difference > 0 ? "over" : "short"}. A
                      discrepancy form will be required.
                    </>
                  )}
                </p>
              )}
            </FormField>
            <FormField id="deposit-date" label="Deposit date">
              <input
                id="deposit-date"
                type="date"
                value={depositDate}
                max={dayKey(today)}
                onChange={(e) => setDepositDate(e.target.value)}
                className={`${inputBase} ${inputOk}`}
              />
            </FormField>
          </div>

          <FormField
            id="deposit-reference"
            label="Reference number"
            hint="The transaction or slip number from the bank."
            error={errors.reference}
          >
            <input
              id="deposit-reference"
              type="text"
              placeholder="e.g. 004512"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              aria-required="true"
              aria-invalid={Boolean(errors.reference)}
              aria-describedby={errors.reference ? "deposit-reference-error" : undefined}
              className={`${inputBase} ${errors.reference ? inputBad : inputOk}`}
            />
          </FormField>

          <PhotoAttach
            id="deposit-slip"
            label="Deposit slip photo"
            hint="Take a photo or choose from the gallery"
            file={slip}
            onChange={(f) => setSlip(f)}
            error={errors.slip}
          />

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? "Recording" : "Record deposit"}
            </button>
            {savedMessage && (
              <p role="status" className="text-[13px] font-medium text-sage-ink">
                Deposit recorded.
              </p>
            )}
          </div>
        </form>
          </section>
        </div>

        {/* History */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface"
          style={{ "--index": 3 } as CSSProperties}
        >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">Recent deposits</h2>
        </div>
        <ul className="mt-1 divide-y divide-line">
          {recorded.map((dep) => (
            <li key={dep.id} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-ink-soft">{dep.dateLabel}</span>
                  <StatusChip matched={dep.matched} />
                </span>
                <span className="mt-0.5 block text-[12px] text-mute">{dep.coversLabel}</span>
              </span>
              <span className="text-[14px] font-semibold tabular-nums text-ink">
                {peso.format(dep.amount)}
              </span>
            </li>
          ))}
        </ul>
        </section>
      </div>
    </>
  )
}
