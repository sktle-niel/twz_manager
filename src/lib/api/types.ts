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

export type Manager = {
  id: string
  name: string
  username: string
  email: string
  storeId: string
  active: boolean
  /** Null until a profile photo is uploaded */
  photoUrl: string | null
}

export type Owner = {
  id: string
  name: string
  username: string
  email: string
  /** Null until a profile photo is uploaded */
  photoUrl: string | null
}

/** Fields an account can change about itself; `photo` uploads a new avatar */
export type ProfileInput = {
  name: string
  username: string
  email: string
  photo?: File | null
  /** True removes the stored photo; a new `photo` wins over it */
  removePhoto?: boolean
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

export type HourPoint = {
  /** 24-hour clock in the branch's timezone */
  hour: number
  amount: number
}

/** One branch, one day — the row the dashboard and the owner table are built from */
export type DailySales = {
  storeId: string
  day: DayKey
  gross: number
  expenses: number
  expected: number
}

export type DayStatus = "open" | "pending" | "matched" | "discrepancy"

export type DayAudit = {
  storeId: string
  day: DayKey
  gross: number
  expenses: number
  expected: number
  /** Null until a deposit covers the day */
  deposited: number | null
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
  amount: number
  reference: string
  /** Audited days this one deposit closes, oldest first */
  covers: DayKey[]
  /** The stored slip photo */
  slipUrl: string
  matched: boolean
}

export type NewDeposit = {
  storeId: string
  day: DayKey
  amount: number
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
