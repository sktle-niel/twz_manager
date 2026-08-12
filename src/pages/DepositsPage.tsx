import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode, SubmitEvent } from "react"
import { Link } from "react-router-dom"
import { CheckCircleIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react"
import { peso, rowDate, shortDate } from "../lib/format"
import { ApiError, api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { addDays, dayKey, fromDayKey, startOfDay } from "../lib/dateRange"
import {
  BranchTag,
  FormField,
  PhotoAttach,
  inputBad,
  inputBase,
  inputOk,
} from "../components/ui"
import { Loading } from "../components/Loading"
import { ReceiptUploader } from "../components/ReceiptUploader"
import { SlipCamera } from "../components/SlipCamera"
import type { ReceiptEntry } from "../lib/receipts"
import { inspectSlip } from "../lib/slipCheck"
import type { KnownSlip, SlipReport } from "../lib/slipCheck"
import { foldBank, readSlip } from "../lib/slipRead"
import { useManagerSession } from "../lib/session"
import { useToast } from "../lib/toast"

type FieldErrors = {
  amount?: string
  online?: string
  date?: string
  reference?: string
  days?: string
  slip?: string
  reason?: string
}

/* Money compares in centavos — float equality on peso sums invents
   discrepancies out of rounding dust */
const cents = (v: number) => Math.round(v * 100)

/*
 * A mismatch can never be closed silently, so the reason is the one field that
 * has to carry real content. Long enough that "ok" and "n/a" cannot stand in
 * for an explanation the owner will read weeks later.
 */
const REASON_MIN = 12

type RecordedDeposit = {
  id: string
  dateLabel: string
  amount: number
  coversLabel: string
  matched: boolean
}


/* One claret line under the day list — the shape every selection warning
   shares, so three different warnings cannot drift into three designs */
function SelectionNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="border-t border-line px-5 py-3">
      <p className="flex items-start gap-1.5 text-[13px] leading-[1.55] text-claret">
        <WarningCircleIcon size={15} weight="fill" aria-hidden="true" className="mt-[2px] shrink-0" />
        <span>{children}</span>
      </p>
    </div>
  )
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
  const { store } = useManagerSession()
  const { showToast } = useToast()
  const storeId = store.id
  const [checkedDays, setCheckedDays] = useState<Record<string, boolean>>({})
  const [amount, setAmount] = useState("")
  /* GCash / bank-transfer money for the covered days — sales that never
     touched the drawer, declared so the cash deposit does not read as short */
  const [online, setOnline] = useState("")
  const [reference, setReference] = useState("")
  const [depositDate, setDepositDate] = useState(() => dayKey(new Date()))
  const [slip, setSlip] = useState<File | null>(null)
  const [slipReport, setSlipReport] = useState<SlipReport | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [reading, setReading] = useState(false)
  /* Which fields the slip filled, so they can say so and stop saying it the
     moment the manager types over them */
  const [fromSlip, setFromSlip] = useState({ amount: false, reference: false, date: false })
  /* Fingerprints of slips already filed, so the same photo cannot cover two
     deposits. Session-only until the backend stores them per branch. */
  const [filedSlips, setFiledSlips] = useState<Record<string, KnownSlip[]>>({})
  const [reason, setReason] = useState("")
  const [proof, setProof] = useState<ReceiptEntry[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  /* Days about to be deposited with nothing logged against them — held here
     while the warning modal asks whether that is really true */
  const [confirmBareDays, setConfirmBareDays] = useState<string[] | null>(null)

  const today = new Date()

  // Every audited day not yet covered by a deposit, however far back it runs
  const pending = useApi(() => api.pendingDeposits(storeId), [storeId])
  const pendingAudits = pending.data ?? []
  const expectedByDay = new Map(pendingAudits.map((a) => [a.day, a.expected]))
  const expensesByDay = new Map(pendingAudits.map((a) => [a.day, a.expenses]))
  const pendingDays = pendingAudits.map((a) => fromDayKey(a.day))

  /* The owner sets how many days may batch into one deposit; 3 until it loads */
  const rules = useApi(() => api.reconciliationRules(), [])
  const batchWindowDays = rules.data?.batchWindowDays ?? 3

  /* Deposits already filed for this branch, back far enough to show the
     recent ones the reconciliation refers to */
  const history = useApi(
    () =>
      api.deposits(storeId, {
        from: dayKey(addDays(startOfDay(today), -60)),
        to: dayKey(startOfDay(today)),
      }),
    [storeId],
  )

  const isChecked = (d: Date) => checkedDays[`${storeId}:${dayKey(d)}`] ?? true
  const selectedDays = pendingDays.filter(isChecked)
  const selectedTotal = selectedDays.reduce(
    (sum, d) => sum + (expectedByDay.get(dayKey(d)) ?? 0),
    0,
  )
  /* Enforced only once the real rule has arrived — blocking on the fallback
     value would refuse selections the owner's actual window allows. The
     backend refuses regardless, so nothing rides on this arriving. */
  const overWindow =
    rules.data !== null && selectedDays.length > rules.data.batchWindowDays
      ? selectedDays.length - rules.data.batchWindowDays
      : 0
  /* Selected days with no expenses logged — usually days someone forgot.
     Flagged in the list the moment they are picked, so the manager hears it
     while there is still time to log, not first at the recording modal. */
  const bareSelected = selectedDays
    .map((d) => dayKey(d))
    .filter((day) => (expensesByDay.get(day) ?? 0) === 0)
  /* Days whose expenses exceed what they took in. The arithmetic is honest —
     nothing is clamped to zero, burying figures is what this app exists to
     prevent — but a negative expected deposit is a slipped digit in an
     expense far more often than a real day, so it is named, not just shown. */
  const negativeSelected = selectedDays
    .map((d) => dayKey(d))
    .filter((day) => (expectedByDay.get(day) ?? 0) < 0)

  const amountValue = Number(amount.replace(/,/g, ""))
  const onlineRaw = Number(online.replace(/,/g, ""))
  /* Blank means none; a bad entry stays out of the sums and validate() names it */
  const onlineValue =
    online.trim() !== "" && Number.isFinite(onlineRaw) && onlineRaw > 0 ? onlineRaw : 0
  const showMatch =
    amount.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0 && selectedDays.length > 0
  /* Signed centavos: positive is over, negative is short. Zero while there is
     nothing to compare, so the discrepancy form only appears once both sides
     exist. Centavos, because an exactly-right ₱12,345.50 must read as a match.
     Cash and online are summed — a GCash sale is not a shortfall. */
  const mismatchCents = showMatch
    ? cents(amountValue) + cents(onlineValue) - cents(selectedTotal)
    : 0
  const mismatchAbs = Math.abs(mismatchCents) / 100

  const recorded: RecordedDeposit[] = (history.data ?? []).map((d) => {
    const days = d.covers.map(fromDayKey)
    return {
      id: d.id,
      dateLabel: dayKey(startOfDay(today)) === d.day ? "Today" : rowDate(fromDayKey(d.day)),
      amount: d.amount,
      coversLabel:
        days.length === 1
          ? `Covers ${shortDate(days[0])}`
          : `Covers ${shortDate(days[0])} and ${shortDate(days[days.length - 1])}`,
      matched: d.matched,
    }
  })

  /* Memoised because the `?? []` fallback would otherwise hand the effect below
     a fresh array on every render, re-inspecting the slip forever */
  const knownSlips = useMemo(() => filedSlips[storeId] ?? [], [filedSlips, storeId])

  /* Read inside the effect rather than through the dependency list: the
     current field values decide only whether to fill them, and depending on
     them would re-inspect the slip on every keystroke */
  const typed = useRef({ amount, reference, depositDate })
  typed.current = { amount, reference, depositDate }
  const defaultDate = dayKey(new Date())

  /* Inspect each slip as it is attached, so a bad one is caught at the moment
     it can still be retaken; read the printed validation only once the frame
     has been accepted as a slip at all */
  useEffect(() => {
    if (!slip) {
      setSlipReport(null)
      setReading(false)
      setFromSlip({ amount: false, reference: false, date: false })
      return
    }
    let cancelled = false
    setSlipReport(null)
    setReading(false)

    inspectSlip(slip, knownSlips, new Date()).then((report) => {
      if (cancelled) return
      setSlipReport(report)
      if (report.level === "fail") return

      setReading(true)
      readSlip(slip, new Date()).then((fields) => {
        if (cancelled) return
        setReading(false)
        /* What the words said, folded into the verdict on the photo — a page
           with none of the BDO slip's wording on it cannot be filed */
        setSlipReport((r) => (r ? foldBank(r, fields) : r))

        const filled = { amount: false, reference: false, date: false }
        /* Figures off a page that is not the slip are not offered — a grocery
           total landing in the amount field would be worse than nothing */
        if (fields.bank.kind !== "other") {
          /* Never write over something the manager already typed — a misread
             figure replacing a correct one is the one outcome worth avoiding */
          if (fields.amount !== null && typed.current.amount.trim() === "") {
            setAmount(String(fields.amount))
            filled.amount = true
          }
          if (fields.reference !== null && typed.current.reference.trim() === "") {
            setReference(fields.reference)
            filled.reference = true
          }
          // The date always holds today by default, so "untouched" is the test
          if (fields.date && typed.current.depositDate === defaultDate) {
            setDepositDate(dayKey(fields.date))
            filled.date = true
          }
        }
        setFromSlip(filled)
      })
    })
    return () => {
      cancelled = true
    }
  }, [slip, knownSlips, defaultDate])

  /* The photo is still being inspected or read. Recording waits: the words
     on the page are part of the verdict now, and a submit that outruns them
     would file what the check was about to refuse. */
  const checking = slip !== null && (slipReport === null || reading)

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const value = Number(amount.replace(/,/g, ""))
    if (!amount.trim()) next.amount = "Enter the amount deposited."
    else if (!Number.isFinite(value) || value <= 0) next.amount = "Enter an amount above zero."
    if (online.trim() !== "" && (!Number.isFinite(onlineRaw) || onlineRaw < 0))
      next.online = "Enter the online amount as a number, or leave it empty."
    if (!/^\d{4}-\d{2}-\d{2}$/.test(depositDate)) next.date = "Enter the deposit date."
    else if (depositDate > dayKey(today)) next.date = "The deposit date cannot be in the future."
    if (!reference.trim()) next.reference = "Enter the reference number from the bank."
    if (selectedDays.length === 0) next.days = "Select at least one day this deposit covers."
    else if (overWindow > 0)
      next.days = `One deposit covers at most ${batchWindowDays} ${
        batchWindowDays === 1 ? "day" : "days"
      }. Unselect ${overWindow} ${overWindow === 1 ? "day" : "days"}, or record more than one deposit.`

    if (!slip) next.slip = "The deposit slip photo is required."
    /* The checks are the gate now, so recording waits for them to finish */
    else if (checking) next.slip = "Still checking the photo. Give it a moment."
    /* Only the near-objective findings block — a file that will not decode, an
       image too small to read, a photo already filed against another deposit,
       a page with none of the BDO slip's wording on it. The heuristics warn
       and go through: being locked out of filing a deposit over a wrong focus
       reading is worse than a slip the owner asks again for. */
    else if (slipReport?.level === "fail") next.slip = slipReport.headline

    if (mismatchCents !== 0 && reason.trim().length < REASON_MIN) {
      next.reason = reason.trim()
        ? `Say a little more: at least ${REASON_MIN} characters.`
        : `Explain the ${peso.format(mismatchAbs)} difference before recording this.`
    }
    return next
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    /* A covered day with nothing logged is usually a day someone forgot:
       expenses lower the expected deposit, and a deposited day is final.
       The list has been flagging it since the day was picked; the modal is
       the last ask, and recording proceeds only on approval. */
    if (bareSelected.length > 0) {
      setConfirmBareDays(bareSelected)
      return
    }

    await submitDeposit()
  }

  async function submitDeposit() {
    setSaving(true)
    // To the centavo, never to the peso — the amount must echo the slip exactly
    const value = cents(Number(amount.replace(/,/g, ""))) / 100
    const covers =
      selectedDays.length === 1
        ? `Covers ${shortDate(selectedDays[0])}`
        : `Covers ${shortDate(selectedDays[0])} to ${shortDate(selectedDays[selectedDays.length - 1])}`

    const onlineAmount = cents(onlineValue) / 100

    try {
      await api.recordDeposit({
        storeId,
        day: depositDate,
        amount: value,
        ...(onlineAmount > 0 ? { online: onlineAmount } : {}),
        reference: reference.trim(),
        covers: selectedDays.map((d) => dayKey(d)),
        slip: slip as File,
        // Advisory only — absent when the device could not compute them
        ...(slipReport?.sha ? { slipSha: slipReport.sha } : {}),
        ...(slipReport?.phash ? { slipPhash: slipReport.phash } : {}),
        ...(mismatchCents !== 0
          ? {
              discrepancy: {
                reason: reason.trim(),
                proof: proof.map((p) => p.file).filter((f): f is File => f !== null),
              },
            }
          : {}),
      })
    } catch (err) {
      /* The form stays filled — a dropped connection must not cost the typing */
      if (err instanceof ApiError && err.fields) {
        // The wire calls the date field `day`; the form slot is `date`
        const { day, ...rest } = err.fields
        setErrors({ ...rest, ...(day ? { date: day } : {}) })
      }
      showToast(err instanceof ApiError ? err.message : "Recording failed. Try again.")
      setSaving(false)
      return
    }
    pending.reload()
    history.reload()
    const shortfallCents = cents(value) + cents(onlineAmount) - cents(selectedTotal)
    // Remember this slip so the same photo cannot cover a second deposit
    if (slipReport) {
      const filed: KnownSlip = {
        sha: slipReport.sha,
        phash: slipReport.phash,
        label: reference.trim(),
      }
      setFiledSlips((prev) => ({ ...prev, [storeId]: [...(prev[storeId] ?? []), filed] }))
    }
    setAmount("")
    setOnline("")
    setReference("")
    setSlip(null)
    setReason("")
    setProof([])
    setSaving(false)
    showToast(
      shortfallCents === 0
        ? `${peso.format(value)}${onlineAmount > 0 ? ` + ${peso.format(onlineAmount)} online` : ""} recorded · ${covers.replace(/^Covers /, "covers ")}.`
        : `Recorded with a discrepancy: ${peso.format(Math.abs(shortfallCents) / 100)} ${shortfallCents > 0 ? "over" : "short"}.`,
    )
  }

  return (
    <>
      <div
        className="mt-6 flex flex-wrap items-center justify-between gap-3"
        data-rise
      >
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Deposits</h1>
          <p className="mt-0.5 text-[13px] text-mute">
            Record each bank deposit and the audited days it covers.
          </p>
        </div>
        <BranchTag name={store.name} />
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          {/* Days waiting for a deposit */}
          <section
            className="rounded-xl border border-line bg-surface"
            data-rise
          >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">For deposit</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            Audited days not yet covered by a bank deposit.
          </p>
          {pendingDays.length > batchWindowDays && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-claret">
              <WarningCircleIcon size={15} weight="fill" aria-hidden="true" />
              {pendingDays.length} days waiting. Deposits are usually made every{" "}
              {batchWindowDays} days.
            </p>
          )}
        </div>
        {pending.error ? (
          /* A failed read must never pass for a clean slate — "all covered"
             on error is a false all-clear */
          <p role="alert" className="flex flex-wrap items-center gap-2 px-5 pb-5 pt-2 text-[13px] text-claret">
            The days waiting for a deposit could not load.
            <button
              type="button"
              onClick={pending.reload}
              className="font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </p>
        ) : pendingDays.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-[13.5px] text-mute">
            {pending.loading ? (
              <Loading />
            ) : (
              "All audited days are covered. Today is still open and will show here once the day is closed."
            )}
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
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[13.5px] font-medium text-ink-soft">{rowDate(d)}</span>
                        {(expensesByDay.get(dayKey(d)) ?? 0) === 0 && (
                          <span className="flex items-center gap-1 text-[12px] font-medium text-claret">
                            <WarningCircleIcon
                              size={13}
                              weight="fill"
                              aria-hidden="true"
                              className="shrink-0"
                            />
                            Nothing logged
                          </span>
                        )}
                        {(expectedByDay.get(dayKey(d)) ?? 0) < 0 && (
                          <span className="flex items-center gap-1 text-[12px] font-medium text-claret">
                            <WarningCircleIcon
                              size={13}
                              weight="fill"
                              aria-hidden="true"
                              className="shrink-0"
                            />
                            Expenses exceed takings
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`text-[14px] font-semibold tabular-nums ${
                        (expectedByDay.get(dayKey(d)) ?? 0) < 0 ? "text-claret" : "text-ink"
                      }`}
                    >
                      {peso.format(expectedByDay.get(dayKey(d)) ?? 0)}
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
            {/* The batching window speaks while days are being picked, not
                first at the recording refusal — the fix is one unselect away */}
            {overWindow > 0 && (
              <SelectionNotice>
                {selectedDays.length} days are selected, but one deposit covers at most{" "}
                {batchWindowDays} {batchWindowDays === 1 ? "day" : "days"} — the owner's batching
                window. Unselect {overWindow} {overWindow === 1 ? "day" : "days"}, or record this
                as more than one deposit.
              </SelectionNotice>
            )}
            {/* A negative day is named the moment it is in the selection —
                the number stays honest, and the likely cause is said out
                loud rather than left to look like a broken app */}
            {negativeSelected.length > 0 && (
              <SelectionNotice>
                {negativeSelected.length === 1
                  ? `${rowDate(fromDayKey(negativeSelected[0]))}'s expenses exceed what it took in, so its expected deposit is negative.`
                  : `${negativeSelected.length} of the selected days' expenses exceed what they took in, so their expected deposits are negative.`}{" "}
                A slipped digit in an expense is the usual cause.{" "}
                <Link to="/expenses" className="font-medium underline underline-offset-4">
                  Check the expense entries
                </Link>{" "}
                before depositing.
              </SelectionNotice>
            )}
            {/* Heard here first: the recording modal will ask again, but by
                then the form is filled — this is where logging is still the
                easy path */}
            {bareSelected.length > 0 && (
              <SelectionNotice>
                {bareSelected.length === 1
                  ? `${rowDate(fromDayKey(bareSelected[0]))} has no expenses logged.`
                  : `${bareSelected.length} of the selected days have no expenses logged.`}{" "}
                Expenses are deducted from the expected deposit, and a deposited day is final.{" "}
                <Link to="/expenses" className="font-medium underline underline-offset-4">
                  Log the expenses first
                </Link>
                , or record anyway and confirm the {bareSelected.length === 1 ? "day" : "days"} had
                none.
              </SelectionNotice>
            )}
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
            className="rounded-xl border border-line bg-surface p-5 sm:p-6"
            data-rise
          >
        <h2 className="text-[15px] font-semibold text-ink">Record a deposit</h2>
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="deposit-amount"
              label="Amount deposited"
              hint={fromSlip.amount ? "Read from the slip. Check it." : undefined}
              error={errors.amount}
            >
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
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setFromSlip((f) => ({ ...f, amount: false }))
                  }}
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
                    mismatchCents === 0 ? "text-sage-ink" : "text-claret"
                  }`}
                >
                  {mismatchCents === 0 ? (
                    <>
                      <CheckCircleIcon size={15} weight="fill" aria-hidden="true" />
                      {onlineValue > 0
                        ? "Cash and online payments together match the expected total."
                        : "Matches the expected total for the selected days."}
                    </>
                  ) : (
                    <>
                      <WarningCircleIcon size={15} weight="fill" aria-hidden="true" />
                      {peso.format(mismatchAbs)} {mismatchCents > 0 ? "over" : "short"} of{" "}
                      {peso.format(selectedTotal)}
                      {onlineValue > 0 ? `, counting ${peso.format(onlineValue)} online` : ""}.
                    </>
                  )}
                </p>
              )}
            </FormField>
            <FormField
              id="deposit-date"
              label="Deposit date"
              hint={fromSlip.date ? "Read from the slip." : undefined}
              error={errors.date}
            >
              <input
                id="deposit-date"
                type="date"
                value={depositDate}
                max={dayKey(today)}
                onChange={(e) => {
                  setDepositDate(e.target.value)
                  setFromSlip((f) => ({ ...f, date: false }))
                }}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? "deposit-date-error" : undefined}
                className={`${inputBase} ${errors.date ? inputBad : inputOk}`}
              />
            </FormField>
            <FormField
              id="deposit-online"
              label="GCash / online payments"
              hint="Money for these days that came in by GCash or bank transfer. Leave empty if none."
              error={errors.online}
            >
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 mt-1 -translate-y-1/2 text-[15px] text-mute"
                >
                  ₱
                </span>
                <input
                  id="deposit-online"
                  inputMode="decimal"
                  placeholder="0"
                  value={online}
                  onChange={(e) => setOnline(e.target.value)}
                  aria-invalid={Boolean(errors.online)}
                  aria-describedby={errors.online ? "deposit-online-error" : undefined}
                  className={`${inputBase} pl-8 ${errors.online ? inputBad : inputOk}`}
                />
              </div>
            </FormField>
          </div>

          <FormField
            id="deposit-reference"
            label="Reference number"
            hint={
              fromSlip.reference
                ? "Read from the slip. Check it."
                : "The transaction or slip number from the bank."
            }
            error={errors.reference}
          >
            <input
              id="deposit-reference"
              type="text"
              placeholder="e.g. 004512"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value)
                setFromSlip((f) => ({ ...f, reference: false }))
              }}
              aria-required="true"
              aria-invalid={Boolean(errors.reference)}
              aria-describedby={errors.reference ? "deposit-reference-error" : undefined}
              className={`${inputBase} ${errors.reference ? inputBad : inputOk}`}
            />
          </FormField>

          <div>
            <PhotoAttach
              id="deposit-slip"
              label="Deposit slip photo"
              hint="Shooting it here guides the framing as you go."
              file={slip}
              onChange={(f) => setSlip(f)}
              onCapture={() => setCameraOpen(true)}
              error={errors.slip}
            />
            {slip && (
              <div role="status" className="mt-2">
                {slipReport === null ? (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-mute">
                    <SpinnerGapIcon size={14} aria-hidden="true" className="shrink-0 animate-spin" />
                    Checking the photo…
                  </p>
                ) : (
                  <div
                    className={`rounded-lg border px-3 py-2 ${
                      slipReport.level === "ok"
                        ? "border-sage-ink/25 bg-sage/60"
                        : "border-claret/40 bg-claret/[0.03]"
                    }`}
                  >
                    <p
                      className={`flex items-start gap-1.5 text-[12.5px] font-medium leading-[1.5] ${
                        slipReport.level === "ok" ? "text-sage-ink" : "text-claret"
                      }`}
                    >
                      {slipReport.level === "ok" ? (
                        <CheckCircleIcon
                          size={14}
                          weight="fill"
                          aria-hidden="true"
                          className="mt-[2px] shrink-0"
                        />
                      ) : (
                        <WarningCircleIcon
                          size={14}
                          weight="fill"
                          aria-hidden="true"
                          className="mt-[2px] shrink-0"
                        />
                      )}
                      {slipReport.headline}
                    </p>
                    {/* Named findings rather than a bare "invalid": a manager
                        cannot fix a verdict that does not say what is wrong */}
                    {slipReport.findings.length > 0 && (
                      <ul className="mt-1.5 space-y-1.5">
                        {slipReport.findings.map((f) => (
                          <li key={f.id} className="text-[12.5px] leading-[1.5] text-ink-soft">
                            <span className="font-medium">{f.title}.</span> {f.detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* The reading itself stays invisible: figures it finds land
                    straight in the fields (marked "Read from the slip"), and
                    the words it finds feed the BDO verdict above. A panel of
                    raw OCR guesses only demanded explaining. */}
                {reading && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-mute">
                    <SpinnerGapIcon size={14} aria-hidden="true" className="shrink-0 animate-spin" />
                    Reading the printed validation…
                  </p>
                )}
              </div>
            )}
          </div>

          {/*
            A mismatch can never be closed silently, so the form appears the
            moment the figures disagree rather than after a failed submit.
          */}
          {mismatchCents !== 0 && (
            <div className="rounded-lg border border-claret/40 bg-claret/[0.03] p-4">
              <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-claret">
                <WarningCircleIcon size={16} weight="fill" aria-hidden="true" />
                Discrepancy: {peso.format(mismatchAbs)} {mismatchCents > 0 ? "over" : "short"}
              </h3>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-soft">
                {peso.format(selectedTotal)} was expected for{" "}
                {selectedDays.length === 1 ? "this day" : `these ${selectedDays.length} days`} and{" "}
                {peso.format(cents(amountValue) / 100)} was deposited
                {onlineValue > 0 ? ` with ${peso.format(cents(onlineValue) / 100)} in online` : ""}.
                This cannot be recorded until the difference is explained.
              </p>

              <div className="mt-3">
                <label
                  htmlFor="deposit-reason"
                  className="text-[13px] font-medium text-ink-soft"
                >
                  Why does it not match?
                </label>
                <textarea
                  id="deposit-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Paid ₱180 for a spare part in cash and the receipt was not logged as an expense yet."
                  aria-required="true"
                  aria-invalid={Boolean(errors.reason)}
                  aria-describedby={errors.reason ? "deposit-reason-error" : undefined}
                  className={`${inputBase} resize-y ${errors.reason ? inputBad : inputOk}`}
                />
                {errors.reason ? (
                  <p id="deposit-reason-error" role="alert" className="mt-1.5 text-[13px] text-claret">
                    {errors.reason}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[12.5px] text-mute">
                    Say what the money went to, or where the extra came from. The owner reads this
                    without the day in front of them.
                  </p>
                )}
              </div>

              <div className="mt-3">
                <ReceiptUploader
                  inputId="deposit-proof"
                  label="Supporting receipts (optional)"
                  hint="Anything that backs up the explanation: a meal receipt, a parts invoice."
                  entries={proof}
                  onChange={setProof}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || checking}
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? "Recording" : checking ? "Checking the slip" : "Record deposit"}
            </button>
          </div>
        </form>
          </section>
        </div>

        {/* History */}
        <section
          className="rounded-xl border border-line bg-surface"
          data-rise
        >
        <div className="px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">Recent deposits</h2>
        </div>
        {history.error ? (
          <p role="alert" className="flex flex-wrap items-center gap-2 px-5 pb-5 pt-2 text-[13px] text-claret">
            Recent deposits could not load.
            <button
              type="button"
              onClick={history.reload}
              className="font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </p>
        ) : recorded.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-[13.5px] text-mute">
            {history.loading ? <Loading /> : "Deposits recorded here will show up in this list."}
          </p>
        ) : (
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
        )}
        </section>
      </div>

      {cameraOpen && (
        <SlipCamera
          onCapture={(file) => {
            setCameraOpen(false)
            setSlip(file)
          }}
          onPickFile={() => {
            setCameraOpen(false)
            /* Let the overlay unmount first — a native file picker opened from
               under a full-screen element is ignored on some mobile browsers */
            window.setTimeout(() => document.getElementById("deposit-slip")?.click(), 0)
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {/* The last look before a day is sealed: no expenses on a covered day
          is usually a day someone forgot to log, and a deposited day can no
          longer be edited */}
      {confirmBareDays !== null && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-ink/25 p-4 sm:items-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="bare-days-title"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-claret/[0.07] text-claret">
                <WarningCircleIcon size={20} weight="bold" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="bare-days-title" className="text-[16px] font-semibold text-ink">
                  {confirmBareDays.length === 1
                    ? "One day has no expenses logged"
                    : `${confirmBareDays.length} days have no expenses logged`}
                </h2>
                <p className="mt-1 text-[13.5px] leading-[1.55] text-ink-soft">
                  {confirmBareDays.map((day) => rowDate(fromDayKey(day))).join(", ")} — nothing is
                  logged against {confirmBareDays.length === 1 ? "this day" : "these days"}. Expenses
                  are deducted from the expected deposit, and once a day is deposited its figures
                  are final.
                </p>
                <p className="mt-2 text-[13.5px] font-medium text-ink">
                  Are you sure {confirmBareDays.length === 1 ? "this day" : "these days"} had no
                  expenses at all?
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmBareDays(null)}
                className="flex h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-[14px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
              >
                Go back and log expenses
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmBareDays(null)
                  void submitDeposit()
                }}
                className="flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-[14px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985]"
              >
                No expenses, record it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
