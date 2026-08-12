/*
 * The domain, as the app understands it. Nothing here mentions Loyverse: the
 * POS is the backend's upstream, not the frontend's. See docs/LOYVERSE.md.
 *
 * Days cross the wire as `YYYY-MM-DD` strings rather than Date objects. A Date
 * is a UTC instant, and a branch's audit day is a local calendar day — parsing
 * "2026-08-03T00:00:00Z" in Manila lands on the 3rd at 8am, which is a day
 * boundary bug waiting for the first late-evening sale.
 *
 * Money crosses the wire as decimal pesos with at most two fraction digits.
 * The client rounds to the centavo before sending and compares in centavos,
 * never with float equality.
 *
 * Photos stored by the backend come back as URLs (`receiptUrls`, `slipUrl`).
 * They are same-origin paths under the API, authorised by the same session
 * cookie as every other request.
 */

/** `YYYY-MM-DD`, in the branch's own timezone */
export type DayKey = string

export type Store = {
  id: string
  name: string
}

/*
 * Accounts have no email address. Nobody signs in with one, nothing is mailed
 * to one, and a forgotten password is fixed by the owner rather than by an
 * inbox — so the field was one more thing to invent when issuing an account
 * and nothing ever read it.
 */

/** Which stock avatar stands in when no photo is uploaded. Girl is the default. */
export type AvatarKind = "girl" | "boy"

export type Manager = {
  id: string
  name: string
  username: string
  storeId: string
  active: boolean
  /** Null until a profile photo is uploaded; the photo always wins over stock */
  photoUrl: string | null
  /** The account's chosen stock avatar; absent reads as "girl" */
  avatarKind?: AvatarKind
}

export type Owner = {
  id: string
  name: string
  username: string
  /** Null until a profile photo is uploaded; the photo always wins over stock */
  photoUrl: string | null
  /** The account's chosen stock avatar; absent reads as "girl" */
  avatarKind?: AvatarKind
}

/** Fields an account can change about itself; `photo` uploads a new avatar */
export type ProfileInput = {
  name: string
  username: string
  /** Which stock avatar to show while no photo is uploaded */
  avatarKind: AvatarKind
  photo?: File | null
  /** True removes the stored photo; a new `photo` wins over it */
  removePhoto?: boolean
}

/**
 * What the owner may know about the recovery PIN. Never the PIN itself — only
 * a hash is stored, so there is nothing to send back. `isDefault` is true while
 * it is still the value the system shipped with, which the settings page says
 * out loud: a documented default is not a secret.
 */
export type ResetPinStatus = {
  isDefault: boolean
  /** How many digits the PIN has, so the form does not have to guess */
  length: number
  /** ISO 8601 instant, or null while it has never been changed */
  changedAt: string | null
}

/** Category names are data now, not a fixed union — the owner edits them */
export type ExpenseCategory = string

export type ExpenseCategoryConfig = {
  id: string
  name: ExpenseCategory
  /** Company-covered: logged without a receipt */
  receiptExempt: boolean
}

export type ExpenseItem = {
  id: string
  storeId: string
  day: DayKey
  category: ExpenseCategory
  note: string
  amount: number
  /** ISO 8601 instant of when it was logged; shown as a local clock time */
  at: string
  /** Stored receipt photos, as same-origin URLs */
  receiptUrls: string[]
}

export type NewExpense = {
  storeId: string
  day: DayKey
  category: ExpenseCategory
  note: string
  amount: number
  receipts: File[]
}

export type ExpensePatch = {
  category?: ExpenseCategory
  note?: string
  amount?: number
  /**
   * Present only when the photos changed: `keep` lists the stored URLs that
   * survive the edit, `add` carries the new files. Anything stored but not in
   * `keep` is deleted — the count alone cannot say which one was removed.
   */
  receipts?: { keep: string[]; add: File[] }
}

/**
 * Cash an employee drew from the drawer against their pay. Not an expense —
 * the shop gets it back — but on the day it is drawn the cash is gone all
 * the same, so the ledger nets it out of that day's expected deposit.
 */
export type AdvanceItem = {
  id: string
  storeId: string
  day: DayKey
  /** The employee's name — employees are not accounts in this app */
  employee: string
  amount: number
  note: string
  /** ISO 8601 instant of when it was logged */
  at: string
}

export type NewAdvance = {
  storeId: string
  day: DayKey
  employee: string
  amount: number
  note?: string
}

export type AdvancePatch = {
  employee?: string
  amount?: number
  note?: string
}

export type HourPoint = {
  /** 24-hour clock in the branch's timezone */
  hour: number
  amount: number
}

/** One branch, one day — the row the dashboard and the owner table are built from */
export type DailySales = {
  storeId: string
  day: DayKey
  /** Money taken at the till, net of refunds — kept on the wire, not displayed */
  gross: number
  /** Gross minus what the goods cost the shop: THE figure, everywhere */
  profit: number
  expenses: number
  /**
   * profit - expenses, the house rule: the capital share of the takings
   * stays in the shop to restock, so the bank gets the profit less the
   * day's spend. The authoritative per-day figure lives on DayAudit.
   */
  expected: number
}

export type DayStatus = "open" | "pending" | "matched" | "discrepancy"

export type DayAudit = {
  storeId: string
  day: DayKey
  /** Money taken at the till — kept on the wire, not displayed */
  gross: number
  /** Gross minus what the goods cost: the figure the audit pages show */
  profit: number
  expenses: number
  /** Cash advances drawn against pay that day — out of the drawer like spend */
  advances: number
  /** profit - expenses - advances: what the deposit must answer (house rule) */
  expected: number
  /** Cash on the covering deposit's slip; null until a deposit covers the day */
  deposited: number | null
  /** GCash / bank-transfer money declared on the covering deposit — counted
      with the cash when the match was judged; null until a deposit exists */
  online: number | null
  /** Every day the covering deposit spans — the whole batch, not just this
      row — so one deposit over six days is never read as six over-deposits */
  depositCovers: DayKey[] | null
  /** The expected sum that deposit was judged against, frozen at recording;
      null before a deposit, or on deposits from before this was stored */
  depositExpected: number | null
  /** Bank reference of the covering deposit */
  reference: string | null
  /** Slip photo of the covering deposit; null until one exists */
  slipUrl: string | null
  status: DayStatus
}

export type Deposit = {
  id: string
  storeId: string
  /** The day the deposit was made, not the days it covers */
  day: DayKey
  /** Cash on the bank slip */
  amount: number
  /** Money for the covered days that came in through GCash or bank transfer
      and never touched the drawer — declared, so it does not read as short */
  online: number
  /** The expected sum over the covered days, frozen when the deposit was
      judged; null on deposits recorded before this was stored */
  expected: number | null
  reference: string
  /** Audited days this one deposit closes, oldest first */
  covers: DayKey[]
  /** The stored slip photo */
  slipUrl: string
  /** Cash plus online against the expected total, judged in centavos */
  matched: boolean
}

export type NewDeposit = {
  storeId: string
  day: DayKey
  amount: number
  /** GCash / bank-transfer money for the covered days; omitted means none */
  online?: number
  reference: string
  covers: DayKey[]
  slip: File
  /**
   * Advisory fingerprints of the slip photo, computed client-side so an
   * obvious duplicate is caught before upload. The backend recomputes the
   * hash itself and owns the real one-photo-one-deposit rule — these values
   * are hints, not authority. Absent when the device could not compute them.
   */
  slipSha?: string
  slipPhash?: string
  /** Required when the amount does not match the expected total */
  discrepancy?: {
    reason: string
    proof: File[]
  }
}

/**
 * One item the sales filter excludes from gross and profit — services and
 * labor, whose money is not the drawer's to deposit. `name` may be empty on
 * entries saved before names were stored; show the SKU then.
 */
export type FilteredItem = {
  sku: string
  name: string
}

export type SignInDeviceKind = "phone" | "computer"

export type SignInEvent = {
  id: string
  device: string
  platform: string
  kind: SignInDeviceKind
  ip: string
  place: string
  /** ISO 8601 instant */
  at: string
  /** The session reading the page right now */
  current: boolean
}
