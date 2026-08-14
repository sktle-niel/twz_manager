/*
 * Everything the app asks of a backend, in one place. docs/API.md is the
 * endpoint-by-endpoint spec a backend implementer builds from; this file is
 * the shape the frontend compiles against. They must not drift.
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
  AdvanceItem,
  AdvancePatch,
  DailySales,
  DayAudit,
  DayKey,
  Deposit,
  ExpenseCategoryConfig,
  ExpenseItem,
  ExpensePatch,
  FilteredItem,
  HourPoint,
  Manager,
  NewAdvance,
  NewDeposit,
  NewExpense,
  Owner,
  ProfileInput,
  ResetPinStatus,
  SearchResults,
  SignInEvent,
  Store,
} from "./types"

export type DayRange = {
  /** Inclusive, `YYYY-MM-DD` */
  from: DayKey
  to: DayKey
}

/**
 * Who is signed in. Exactly one of the two is set for a signed-in session —
 * an account is a manager or the owner, never both. Both are null when nobody
 * is signed in: that is a normal answer, not an error, so `session()` never
 * fails just because the visitor is anonymous.
 */
export type Session = {
  manager: Manager | null
  owner: Owner | null
}

export type TwzApi = {
  /* ---- identity ---- */

  /** Who is signed in. The backend decides from the session cookie. */
  session(): Promise<Session>
  /**
   * `remember` asks for a long-lived cookie instead of a browser-session one.
   * Rejects with 401 and a human message when the credentials are wrong.
   */
  signIn(identifier: string, password: string, remember?: boolean): Promise<Session>
  signOut(): Promise<void>
  signIns(accountId: string): Promise<SignInEvent[]>

  /* ---- the signed-in account ---- */

  /** Updates whoever is signed in; returns the refreshed session. */
  updateProfile(input: ProfileInput): Promise<Session>
  /** Rejects with a field error on `current` when the password is wrong. */
  changePassword(current: string, next: string): Promise<void>

  /* ---- branches and accounts ---- */

  stores(): Promise<Store[]>
  managers(): Promise<Manager[]>
  /**
   * Issues a branch account. With no email anywhere in the system the owner
   * sets both halves of the credential: the username, which the manager signs
   * in with, and the first password, which is handed over in person.
   * Rejects 422 with `fields.username` when the username is taken.
   */
  issueManager(input: {
    name: string
    username: string
    storeId: string
    password: string
  }): Promise<Manager>
  /** Reassigning a held branch swaps the two managers, server-side */
  assignBranch(managerId: string, storeId: string): Promise<Manager[]>
  /**
   * Disables or re-enables a branch account. Disabling signs the manager out
   * everywhere (sessions, remembered devices, push mailboxes) and sign-in
   * refuses them until re-enabled; the branch assignment stays until changed.
   */
  setManagerActive(managerId: string, active: boolean): Promise<Manager[]>

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

  /* ---- cash advances ---- */

  /** Drawer money an employee drew against pay; nets out of the day's expected deposit */
  advances(storeId: string, range: DayRange): Promise<AdvanceItem[]>
  addAdvance(input: NewAdvance): Promise<AdvanceItem>
  updateAdvance(id: string, patch: AdvancePatch): Promise<AdvanceItem>
  deleteAdvance(id: string): Promise<void>

  /* ---- audit and deposits ---- */

  dayAudits(storeIds: string[], range: DayRange): Promise<DayAudit[]>
  /** Audited days with no deposit against them yet, oldest first */
  pendingDeposits(storeId: string): Promise<DayAudit[]>

  /* ---- search ---- */

  /**
   * One query over everything the caller may see, covering the last 90 days.
   * Every token must land somewhere in a record; a recognised date ("july 3",
   * "7/3/2026") narrows by the record's own day. Groups come back capped,
   * newest first, with `total` counting every match. The branch scope is the
   * caller's request, never their authority.
   */
  search(q: string, storeIds: string[]): Promise<SearchResults>
  deposits(storeId: string, range: DayRange): Promise<Deposit[]>
  /** Rejects 409 with a field error on `slip` when the photo already covers a deposit */
  recordDeposit(input: NewDeposit): Promise<Deposit>

  /* ---- recovery (owner only) ---- */

  /**
   * Sets a manager's password without knowing the old one — the whole point,
   * since nobody has it. Guarded by the PIN as well as by being the owner, so
   * a laptop left signed in is not enough to take a branch account.
   * Rejects 422 with `fields.pin` on a wrong PIN, 429 once it has been wrong
   * too many times.
   */
  setManagerPassword(managerId: string, pin: string, password: string): Promise<void>
  /** Whether the PIN is still the shipped default, and when it last changed. */
  resetPin(): Promise<ResetPinStatus>
  /** Rejects 422 with `fields.currentPin` when the old PIN is wrong. */
  changeResetPin(currentPin: string, newPin: string): Promise<void>

  /* ---- push reminders ---- */

  /** The VAPID public key this browser subscribes with */
  pushKey(): Promise<string>
  /** Register this browser's push mailbox to the signed-in account */
  savePushSubscription(subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }): Promise<void>
  /** Forget this browser's mailbox */
  deletePushSubscription(endpoint: string): Promise<void>

  /* ---- settings ---- */

  posConnection(): Promise<{ connected: boolean; storesLinked: number; tokenHint: string }>
  reconnectPos(): Promise<void>

  /* ---- the sales filter (owner only) ---- */

  /** Items excluded from gross and profit — services and labor */
  salesFilter(): Promise<FilteredItem[]>
  /**
   * Whole-list replace. Changing the SKUs makes the backend re-pull the
   * sales history so past figures agree with the list — charts refill within
   * a few minutes of a save.
   */
  saveSalesFilter(items: FilteredItem[]): Promise<FilteredItem[]>
  /**
   * Search the POS item catalog by name or SKU. The backend walks the
   * catalog once and caches it; the frontend never pulls the whole thing.
   */
  searchCatalog(q: string): Promise<FilteredItem[]>
  reconciliationRules(): Promise<{ batchWindowDays: number }>
  saveReconciliationRules(rules: { batchWindowDays: number }): Promise<void>
}

