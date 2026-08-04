/*
 * The real adapter. Every method is one request against our own backend — see
 * docs/LOYVERSE.md for what that backend owes upstream.
 */
import { get, send, upload } from "./client"
import type { DayRange, Session, TwzApi } from "./contracts"
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
  SignInEvent,
  Store,
} from "./types"

const range = (r: DayRange) => ({ from: r.from, to: r.to })

export const httpApi: TwzApi = {
  session: () => get<Session>("/session"),
  signIn: (identifier, password) => send<Session>("POST", "/session", { identifier, password }),
  signOut: () => send<void>("DELETE", "/session"),
  signIns: (accountId) => get<SignInEvent[]>(`/accounts/${accountId}/sign-ins`),

  stores: () => get<Store[]>("/stores"),
  managers: () => get<Manager[]>("/managers"),
  issueManager: (input) => send<Manager>("POST", "/managers", input),
  assignBranch: (managerId, storeId) =>
    send<Manager[]>("PATCH", `/managers/${managerId}/branch`, { storeId }),

  dailySales: (storeIds, r) => get<DailySales[]>("/sales/daily", { storeIds, ...range(r) }),
  hourlySales: (storeIds, day) => get<HourPoint[]>("/sales/hourly", { storeIds, day }),

  expenses: (storeId, r) => get<ExpenseItem[]>("/expenses", { storeId, ...range(r) }),
  addExpenses: (items: NewExpense[]) =>
    upload<ExpenseItem[]>(
      "/expenses",
      // The files travel as parts, so only the fields go in the JSON body
      {
        items: items.map((item) => ({
          storeId: item.storeId,
          day: item.day,
          category: item.category,
          note: item.note,
          amount: item.amount,
        })),
      },
      // Receipts are flattened with an index prefix so the server can put each
      // photo back against the line it belongs to
      Object.fromEntries(items.map((item, i) => [`receipts[${i}]`, item.receipts])),
    ),
  updateExpense: (id, patch: ExpensePatch) =>
    patch.receipts
      ? upload<ExpenseItem>(
          `/expenses/${id}`,
          { category: patch.category, note: patch.note, amount: patch.amount },
          { receipts: patch.receipts },
        )
      : send<ExpenseItem>("PATCH", `/expenses/${id}`, patch),
  deleteExpense: (id) => send<void>("DELETE", `/expenses/${id}`),

  expenseCategories: () => get<ExpenseCategoryConfig[]>("/expense-categories"),
  saveExpenseCategories: (categories) =>
    send<ExpenseCategoryConfig[]>("PUT", "/expense-categories", categories),

  dayAudits: (storeIds, r) => get<DayAudit[]>("/audits", { storeIds, ...range(r) }),
  pendingDeposits: (storeId) => get<DayAudit[]>("/deposits/pending", { storeId }),
  deposits: (storeId, r) => get<Deposit[]>("/deposits", { storeId, ...range(r) }),
  recordDeposit: (input: NewDeposit) =>
    upload<Deposit>(
      "/deposits",
      {
        storeId: input.storeId,
        day: input.day,
        amount: input.amount,
        reference: input.reference,
        covers: input.covers,
        slipSha: input.slipSha,
        slipPhash: input.slipPhash,
        discrepancyReason: input.discrepancy?.reason,
      },
      { slip: [input.slip], discrepancyProof: input.discrepancy?.proof ?? [] },
    ),

  posConnection: () =>
    get<{ connected: boolean; storesLinked: number; tokenHint: string }>("/settings/pos"),
  reconnectPos: () => send<void>("POST", "/settings/pos/reconnect"),
  reconciliationRules: () => get<{ batchWindowDays: number }>("/settings/reconciliation"),
  saveReconciliationRules: (rules) => send<void>("PATCH", "/settings/reconciliation", rules),
}

export type { DayKey }
