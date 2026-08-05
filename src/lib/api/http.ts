/*
 * The real adapter. Every method is one request against our own backend — see
 * docs/API.md for the endpoint spec and docs/LOYVERSE.md for what that backend
 * owes upstream.
 */
import { ApiError, get, send, upload } from "./client"
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
  ProfileInput,
  ResetPinStatus,
  SignInEvent,
  Store,
} from "./types"

const range = (r: DayRange) => ({ from: r.from, to: r.to })

export const httpApi: TwzApi = {
  session: () =>
    get<Session>("/session").catch((err: unknown) => {
      /* Anonymous is an answer, not a failure — a backend that 401s the
         session probe must not brick the boot sequence */
      if (err instanceof ApiError && err.status === 401) {
        return { manager: null, owner: null }
      }
      throw err
    }),
  signIn: (identifier, password, remember = false) =>
    send<Session>("POST", "/session", { identifier, password, remember }),
  signOut: () => send<void>("DELETE", "/session"),
  signIns: (accountId) => get<SignInEvent[]>(`/accounts/${accountId}/sign-ins`),

  setManagerPassword: (managerId, pin, password) =>
    send<void>("PUT", `/managers/${managerId}/password`, { pin, password }),
  resetPin: () => get<ResetPinStatus>("/settings/reset-pin"),
  changeResetPin: (currentPin, newPin) =>
    send<void>("PUT", "/settings/reset-pin", { currentPin, newPin }),

  updateProfile: (input: ProfileInput) =>
    input.photo
      ? upload<Session>(
          "PATCH",
          "/account",
          { name: input.name, username: input.username, avatarKind: input.avatarKind },
          { photo: [input.photo] },
        )
      : send<Session>("PATCH", "/account", {
          name: input.name,
          username: input.username,
          avatarKind: input.avatarKind,
          ...(input.removePhoto ? { removePhoto: true } : {}),
        }),
  changePassword: (current, next) =>
    send<void>("PUT", "/account/password", { current, next }),

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
      "POST",
      "/expenses",
      // The files travel as parts, so only the fields go in the payload
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
          "PATCH",
          `/expenses/${id}`,
          {
            ...(patch.category !== undefined ? { category: patch.category } : {}),
            ...(patch.note !== undefined ? { note: patch.note } : {}),
            ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
            keepReceipts: patch.receipts.keep,
          },
          { receipts: patch.receipts.add },
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
      "POST",
      "/deposits",
      {
        storeId: input.storeId,
        day: input.day,
        amount: input.amount,
        reference: input.reference,
        covers: input.covers,
        ...(input.slipSha ? { slipSha: input.slipSha } : {}),
        ...(input.slipPhash ? { slipPhash: input.slipPhash } : {}),
        ...(input.discrepancy ? { discrepancyReason: input.discrepancy.reason } : {}),
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
