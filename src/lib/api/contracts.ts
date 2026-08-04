/*
 * Everything the app asks of a backend, in one place.
 *
 * Two rules shaped this list:
 *
 * 1. **Range-shaped, never per-day.** The dashboard wants 90 days; it makes one
 *    call, not ninety. The sample data could afford a function per day because
 *    it was generated in memory — over a network that pattern is a stampede,
 *    and against Loyverse's 300-requests-per-300-seconds account budget it is
 *    an outage. See docs/LOYVERSE.md.
 *
 * 2. **The branch scope is an argument, not a filter applied later.** A manager
 *    is locked to one branch, and passing `storeIds` down to the query is what
 *    makes that a server-side fact rather than a UI convention.
 */
import type {
  DailySales,
  DayAudit,
  DayKey,
  Deposit,
  ExpenseCategoryConfig,
  ExpenseItem,
  ExpensePatch,
  HourPoint,
  Manager,
  NewDeposit,
  NewExpense,
  Owner,
  SignInEvent,
  Store,
} from "./types"

export type DayRange = {
  /** Inclusive, `YYYY-MM-DD` */
  from: DayKey
  to: DayKey
}

export type Session = {
  manager: Manager | null
  owner: Owner | null
}

export type TwzApi = {
  /* ---- identity ---- */

  /** Who is signed in. The backend decides from the session cookie. */
  session(): Promise<Session>
  signIn(identifier: string, password: string): Promise<Session>
  signOut(): Promise<void>
  signIns(accountId: string): Promise<SignInEvent[]>

  /* ---- branches and accounts ---- */

  stores(): Promise<Store[]>
  managers(): Promise<Manager[]>
  issueManager(input: { name: string; email: string; storeId: string }): Promise<Manager>
  /** Reassigning a held branch swaps the two managers, server-side */
  assignBranch(managerId: string, storeId: string): Promise<Manager[]>

  /* ---- sales ---- */

  /** One row per branch per day. The spine of the dashboard and the owner table. */
  dailySales(storeIds: string[], range: DayRange): Promise<DailySales[]>
  /** Today's running total, hour by hour; partial while the day is open */
  hourlySales(storeIds: string[], day: DayKey): Promise<HourPoint[]>

  /* ---- expenses ---- */

  expenses(storeId: string, range: DayRange): Promise<ExpenseItem[]>
  addExpenses(items: NewExpense[]): Promise<ExpenseItem[]>
  updateExpense(id: string, patch: ExpensePatch): Promise<ExpenseItem>
  deleteExpense(id: string): Promise<void>

  expenseCategories(): Promise<ExpenseCategoryConfig[]>
  saveExpenseCategories(categories: ExpenseCategoryConfig[]): Promise<ExpenseCategoryConfig[]>

  /* ---- audit and deposits ---- */

  dayAudits(storeIds: string[], range: DayRange): Promise<DayAudit[]>
  /** Audited days with no deposit against them yet, oldest first */
  pendingDeposits(storeId: string): Promise<DayAudit[]>
  deposits(storeId: string, range: DayRange): Promise<Deposit[]>
  recordDeposit(input: NewDeposit): Promise<Deposit>

  /* ---- settings ---- */

  posConnection(): Promise<{ connected: boolean; storesLinked: number; tokenHint: string }>
  reconnectPos(): Promise<void>
  reconciliationRules(): Promise<{ batchWindowDays: number }>
  saveReconciliationRules(rules: { batchWindowDays: number }): Promise<void>
}

/*
 * Search deliberately has no entry here. It currently builds its index in the
 * browser from data already on the page, which cannot survive a real dataset —
 * the backend will own it as a single query endpoint. Wiring the present
 * client-side index into this contract would freeze the wrong shape.
 */
