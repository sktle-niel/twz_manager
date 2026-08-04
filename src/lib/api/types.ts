/*
 * The domain, as the app understands it. Nothing here mentions Loyverse: the
 * POS is the backend's upstream, not the frontend's. See docs/LOYVERSE.md.
 *
 * Days cross the wire as `YYYY-MM-DD` strings rather than Date objects. A Date
 * is a UTC instant, and a branch's audit day is a local calendar day — parsing
 * "2026-08-03T00:00:00Z" in Manila lands on the 3rd at 8am, which is a day
 * boundary bug waiting for the first late-evening sale.
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
}

export type Owner = {
  id: string
  name: string
  username: string
  email: string
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
  /** "3:05 PM", as logged */
  time: string
  /** How many receipt photos are on file */
  receiptCount: number
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
  receipts?: File[]
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
  matched: boolean
}

export type NewDeposit = {
  storeId: string
  day: DayKey
  amount: number
  reference: string
  covers: DayKey[]
  slip: File
  /** Fingerprints of the slip photo, so one photo cannot cover two deposits */
  slipSha: string
  slipPhash: string
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
