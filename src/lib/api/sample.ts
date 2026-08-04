/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  SAMPLE DATA — NOT FOR PRODUCTION. Delete this file with the backend.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every figure is generated from a seed made of the branch id and the date, so
 * the same day always shows the same numbers and screenshots stay stable.
 *
 * It lives behind `TwzApi` rather than being imported by pages, which is the
 * whole point of the move: nothing outside this file knows the data is made
 * up, so swapping in `httpApi` changes one line and no page at all. Writes are
 * held in module-level maps so it behaves like a server for a session — a
 * logged expense stays logged while you navigate away and back.
 *
 * Selected by VITE_DATA_SOURCE=sample; see src/lib/api/index.ts.
 */
import { addDays, dayKey, fromDayKey, startOfDay } from "../dateRange"
import type { DayRange, Session, TwzApi } from "./contracts"
import type {
  DailySales,
  DayAudit,
  DayKey,
  DayStatus,
  Deposit,
  ExpenseCategoryConfig,
  ExpenseItem,
  HourPoint,
  Manager,
  Owner,
  SignInEvent,
  Store,
} from "./types"

/* Pretend the network exists, so loading states are real during development */
const LATENCY = 120
const settle = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY))

/* ---- fixtures ---- */

const STORES: Store[] = [
  { id: "arevalo", name: "Arevalo" },
  { id: "molo", name: "Molo" },
  { id: "jaro", name: "Jaro" },
  { id: "lapaz", name: "La Paz" },
]

const OWNER: Owner = {
  id: "owner",
  name: "Two Wheels Zone",
  username: "twz.owner",
  email: "owner@gmail.com",
}

const SEED_MANAGERS: Manager[] = [
  {
    id: "m-arevalo",
    name: "Marvin Deocampo",
    username: "marvin.deocampo",
    email: "marvin.deocampo@gmail.com",
    storeId: "arevalo",
    active: true,
  },
  {
    id: "m-molo",
    name: "Joel Sarabia",
    username: "joel.sarabia",
    email: "joel.sarabia@gmail.com",
    storeId: "molo",
    active: true,
  },
  {
    id: "m-jaro",
    name: "Rhea Villanueva",
    username: "rhea.villanueva",
    email: "rhea.villanueva@gmail.com",
    storeId: "jaro",
    active: true,
  },
]

const SEED_CATEGORIES: ExpenseCategoryConfig[] = [
  { id: "meals", name: "Meals", receiptExempt: true },
  { id: "merienda", name: "Merienda", receiptExempt: true },
  { id: "water-bill", name: "Water bill", receiptExempt: false },
  { id: "electric-bill", name: "Electric bill", receiptExempt: false },
  { id: "wifi-bill", name: "Wifi bill", receiptExempt: false },
  { id: "other", name: "Other", receiptExempt: false },
]

/* ---- session state, standing in for a server ---- */

let managers = [...SEED_MANAGERS]
let categories = [...SEED_CATEGORIES]
let signedIn: Session = { manager: managers[0], owner: null }
let rules = { batchWindowDays: 3 }

/** Expenses added this session, and ids removed or edited, keyed by store:day */
const addedExpenses = new Map<string, ExpenseItem[]>()
const removedExpenses = new Set<string>()
const editedExpenses = new Map<string, Partial<ExpenseItem>>()
const recordedDeposits = new Map<string, Deposit[]>()
/** Days closed by a deposit recorded this session */
const clearedDays = new Set<string>()

/* ---- deterministic generators ---- */

function hashSeed(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const OPEN_HOUR = 8
// Late-morning peak, midday lull, late-afternoon pickup, over 12 open hours
const HOUR_WEIGHT = [0.4, 0.75, 1.0, 1.1, 0.9, 0.7, 0.8, 1.0, 1.15, 1.05, 0.8, 0.5]

const BASE_DAILY: Record<string, number> = {
  arevalo: 46_000,
  molo: 31_500,
  jaro: 38_500,
  lapaz: 35_000,
}

function isToday(day: DayKey): boolean {
  return day === dayKey(new Date())
}

function hourlyFor(storeId: string, day: DayKey): HourPoint[] {
  const date = fromDayKey(day)
  const rand = mulberry32(hashSeed(`${storeId}:${day}`))
  const base = BASE_DAILY[storeId] ?? 30_000
  const dow = date.getDay()
  const dowFactor = dow === 0 ? 0.55 : dow === 6 ? 1.2 : 1
  const dayFactor = dowFactor * (0.8 + rand() * 0.45)
  const weightSum = HOUR_WEIGHT.reduce((a, b) => a + b, 0)
  const all = HOUR_WEIGHT.map((w, i) => ({
    hour: OPEN_HOUR + i,
    amount: Math.round((base * dayFactor * w * (0.7 + rand() * 0.6)) / weightSum),
  }))
  if (!isToday(day)) return all
  const nowHour = new Date().getHours()
  return all.filter((p) => p.hour <= nowHour)
}

function grossFor(storeId: string, day: DayKey): number {
  return hourlyFor(storeId, day).reduce((sum, p) => sum + p.amount, 0)
}

const OTHER_NOTES = [
  "Tricycle fare, parts pickup",
  "Drinking water refill",
  "Cleaning supplies",
  "Receipt paper rolls",
]

/* Utility bills arrive once a month on a fixed day, per branch */
const MONTHLY_BILLS = [
  { id: "electric", day: 5, category: "Electric bill", min: 7_800, spread: 5_200, time: "9:40 AM" },
  { id: "water", day: 10, category: "Water bill", min: 780, spread: 620, time: "10:15 AM" },
  { id: "wifi", day: 15, category: "Wifi bill", min: 1_699, spread: 800, time: "2:20 PM" },
]

function minutesOfDay(time: string): number {
  const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(time)
  if (!m) return 0
  return ((Number(m[1]) % 12) + (/pm/i.test(m[3]) ? 12 : 0)) * 60 + Number(m[2])
}

/* This many days back the branch never logged its spend — the "manager forgot"
   case, so the Expenses page has a real gap to flag */
const UNLOGGED_DAY = 4

export const DEPOSIT_TIMELINE = {
  /* Days 1..6 are audited but still waiting for a deposit */
  pendingThrough: 6,
  /* One deposit covered these two days, oldest first */
  matchedPair: [8, 7],
  shortDay: 9,
  shortfall: 180,
}

function daysBack(day: DayKey): number {
  return Math.round((startOfDay(new Date()).getTime() - fromDayKey(day).getTime()) / 86_400_000)
}

function spendLogged(storeId: string, day: DayKey): boolean {
  const diff = daysBack(day)
  if (diff === UNLOGGED_DAY) return false
  if (diff <= DEPOSIT_TIMELINE.pendingThrough) return true
  return mulberry32(hashSeed(`logged:${storeId}:${day}`))() > 0.1
}

function generatedExpenses(storeId: string, day: DayKey): ExpenseItem[] {
  const rand = mulberry32(hashSeed(`exp:${storeId}:${day}`))
  const key = `${storeId}-${day}`
  const date = fromDayKey(day)
  const items: ExpenseItem[] = []
  const base = { storeId, day, receiptCount: 0 }

  if (spendLogged(storeId, day)) {
    items.push(
      {
        ...base,
        id: `${key}-lunch`,
        category: "Meals",
        note: "Staff lunch",
        amount: 220 + Math.round(rand() * 180),
        time: `11:${String(30 + Math.round(rand() * 25)).padStart(2, "0")} AM`,
      },
      {
        ...base,
        id: `${key}-merienda`,
        category: "Merienda",
        note: "Afternoon merienda",
        amount: 120 + Math.round(rand() * 140),
        time: `3:${String(10 + Math.round(rand() * 40)).padStart(2, "0")} PM`,
      },
    )
    if (rand() > 0.72) {
      items.push({
        ...base,
        id: `${key}-other`,
        category: "Other",
        note: OTHER_NOTES[Math.floor(rand() * OTHER_NOTES.length)],
        amount: 250 + Math.round(rand() * 1400),
        time: `1:${String(10 + Math.round(rand() * 40)).padStart(2, "0")} PM`,
        receiptCount: 1,
      })
    }
  }

  // Seeded apart from the daily spend so adding bills never shifts it
  const billRand = mulberry32(hashSeed(`bill:${storeId}:${day}`))
  const period = new Date(date.getFullYear(), date.getMonth() - 1, 1).toLocaleDateString("en-US", {
    month: "long",
  })
  for (const bill of MONTHLY_BILLS) {
    if (date.getDate() !== bill.day) continue
    items.push({
      ...base,
      id: `${key}-${bill.id}`,
      category: bill.category,
      note: `${period} billing period`,
      amount: bill.min + Math.round(billRand() * bill.spread),
      time: bill.time,
      receiptCount: 1,
    })
  }
  return items
}

function expensesFor(storeId: string, day: DayKey): ExpenseItem[] {
  const generated = generatedExpenses(storeId, day)
  const added = addedExpenses.get(`${storeId}:${day}`) ?? []
  return [...generated, ...added]
    .filter((i) => !removedExpenses.has(i.id))
    .map((i) => ({ ...i, ...(editedExpenses.get(i.id) ?? {}) }))
    .sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time))
}

function expenseTotal(storeId: string, day: DayKey): number {
  return expensesFor(storeId, day).reduce((sum, i) => sum + i.amount, 0)
}

function referenceFor(storeId: string, key: string): string {
  return String(Math.floor(mulberry32(hashSeed(`ref:${storeId}:${key}`))() * 1_000_000)).padStart(
    6,
    "0",
  )
}

function auditFor(storeId: string, day: DayKey): DayAudit {
  const gross = grossFor(storeId, day)
  const expenses = expenseTotal(storeId, day)
  const expected = gross - expenses
  const diff = daysBack(day)
  const base = { storeId, day, gross, expenses, expected }

  if (diff <= 0) return { ...base, deposited: null, reference: null, status: "open" }

  if (diff <= DEPOSIT_TIMELINE.pendingThrough) {
    if (!clearedDays.has(`${storeId}:${day}`))
      return { ...base, deposited: null, reference: null, status: "pending" }
    // Closed by a deposit recorded this session
    const covering = (recordedDeposits.get(storeId) ?? []).find((d) => d.covers.includes(day))
    return {
      ...base,
      deposited: expected,
      reference: covering?.reference ?? referenceFor(storeId, day),
      status: covering && !covering.matched ? "discrepancy" : "matched",
    }
  }

  if (diff === DEPOSIT_TIMELINE.shortDay) {
    return {
      ...base,
      deposited: expected - DEPOSIT_TIMELINE.shortfall,
      reference: referenceFor(storeId, day),
      status: "discrepancy",
    }
  }

  if (DEPOSIT_TIMELINE.matchedPair.includes(diff)) {
    // Both days went in on one deposit, so they share a reference
    const newer = dayKey(addDays(fromDayKey(day), diff - DEPOSIT_TIMELINE.matchedPair[1]))
    return {
      ...base,
      deposited: expected,
      reference: referenceFor(storeId, `pair:${newer}`),
      status: "matched",
    }
  }

  const rand = mulberry32(hashSeed(`status:${storeId}:${day}`))
  const reference = referenceFor(storeId, day)
  if (rand() > 0.87) {
    const shortfall = 100 + Math.round(rand() * 400)
    return { ...base, deposited: expected - shortfall, reference, status: "discrepancy" as DayStatus }
  }
  return { ...base, deposited: expected, reference, status: "matched" }
}

function eachDay(range: DayRange): DayKey[] {
  const out: DayKey[] = []
  const end = fromDayKey(range.to)
  for (let d = fromDayKey(range.from); d <= end; d = addDays(d, 1)) out.push(dayKey(d))
  return out
}

/* ---- sign-in history ---- */

const SIGN_IN_DEVICES = [
  { device: "Realme 6", platform: "Android 11 · Chrome 124", kind: "phone" as const },
  { device: "Windows laptop", platform: "Windows 11 · Edge 126", kind: "computer" as const },
  { device: "Redmi Note 12", platform: "Android 13 · Chrome 125", kind: "phone" as const },
  { device: "iPhone 11", platform: "iOS 17 · Safari", kind: "phone" as const },
]
const SIGN_IN_IP_BLOCKS = ["112.198.104", "180.190.23", "119.94.61", "203.177.42"]
const SIGN_IN_PLACES = ["Iloilo City, PH", "Mandurriao, Iloilo", "Pavia, Iloilo", "Oton, Iloilo"]

function signInLog(accountId: string): SignInEvent[] {
  const rand = mulberry32(hashSeed(`signin:${accountId}`))
  const start = Math.floor(rand() * SIGN_IN_DEVICES.length)
  const gaps = [
    25 + Math.round(rand() * 150),
    4 * 60 + Math.round(rand() * 600),
    26 * 60 + Math.round(rand() * 900),
    50 * 60 + Math.round(rand() * 1200),
  ]
  const now = Date.now()
  let minutes = 0
  return SIGN_IN_DEVICES.map((_, i) => {
    minutes += gaps[i]
    const slot = (start + i) % SIGN_IN_DEVICES.length
    const device = SIGN_IN_DEVICES[slot]
    return {
      id: `${accountId}-signin-${i}`,
      ...device,
      ip: `${SIGN_IN_IP_BLOCKS[slot]}.${2 + Math.floor(rand() * 250)}`,
      place: SIGN_IN_PLACES[slot],
      at: new Date(now - minutes * 60_000).toISOString(),
      current: i === 0,
    }
  })
}

/* ---- the adapter ---- */

export const sampleApi: TwzApi = {
  /* Both identities come back because there is no auth yet and the owner area
     is reachable by URL. A real backend returns only who is actually signed in. */
  session: () => settle({ manager: signedIn.manager ?? managers[0], owner: OWNER }),

  signIn: (identifier) => {
    const id = identifier.trim().toLowerCase()
    if (id === OWNER.username || id === OWNER.email) {
      signedIn = { manager: null, owner: OWNER }
    } else {
      const found =
        managers.find((m) => m.username.toLowerCase() === id || m.email.toLowerCase() === id) ??
        managers[0]
      signedIn = { manager: found, owner: null }
    }
    return settle(signedIn)
  },

  signOut: () => {
    signedIn = { manager: null, owner: null }
    return settle(undefined)
  },

  signIns: (accountId) => settle(signInLog(accountId)),

  stores: () => settle(STORES),
  managers: () => settle([...managers]),

  issueManager: (input) => {
    const username = input.name.trim().toLowerCase().replace(/\s+/g, ".")
    const created: Manager = {
      id: `m-${Date.now().toString(36)}`,
      name: input.name.trim(),
      username,
      email: input.email.trim(),
      storeId: input.storeId,
      active: true,
    }
    managers = [...managers, created]
    return settle(created)
  },

  assignBranch: (managerId, storeId) => {
    const moving = managers.find((m) => m.id === managerId)
    if (moving) {
      // One branch, one manager: taking a held branch swaps the two
      const holder = managers.find((m) => m.storeId === storeId && m.id !== managerId)
      const vacated = moving.storeId
      managers = managers.map((m) =>
        m.id === managerId
          ? { ...m, storeId }
          : holder && m.id === holder.id
            ? { ...m, storeId: vacated }
            : m,
      )
      if (signedIn.manager?.id === managerId) {
        signedIn = { ...signedIn, manager: managers.find((m) => m.id === managerId) ?? null }
      }
    }
    return settle([...managers])
  },

  dailySales: (storeIds, range) => {
    const rows: DailySales[] = []
    for (const storeId of storeIds) {
      for (const day of eachDay(range)) {
        const gross = grossFor(storeId, day)
        const expenses = expenseTotal(storeId, day)
        rows.push({ storeId, day, gross, expenses, expected: gross - expenses })
      }
    }
    return settle(rows)
  },

  hourlySales: (storeIds, day) => {
    const perStore = storeIds.map((id) => hourlyFor(id, day))
    const length = perStore[0]?.length ?? 0
    return settle(
      Array.from({ length }, (_, i) => ({
        hour: perStore[0][i].hour,
        amount: perStore.reduce((sum, list) => sum + (list[i]?.amount ?? 0), 0),
      })),
    )
  },

  expenses: (storeId, range) =>
    settle(eachDay(range).flatMap((day) => expensesFor(storeId, day))),

  addExpenses: (items) => {
    const created = items.map((item, i) => ({
      id: `local-${Date.now().toString(36)}-${i}`,
      storeId: item.storeId,
      day: item.day,
      category: item.category,
      note: item.note,
      amount: item.amount,
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      receiptCount: item.receipts.length,
    }))
    for (const item of created) {
      const key = `${item.storeId}:${item.day}`
      addedExpenses.set(key, [...(addedExpenses.get(key) ?? []), item])
    }
    return settle(created)
  },

  updateExpense: (id, patch) => {
    const next = {
      ...(editedExpenses.get(id) ?? {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.receipts !== undefined ? { receiptCount: patch.receipts.length } : {}),
    }
    editedExpenses.set(id, next)
    return settle({ id, ...next } as ExpenseItem)
  },

  deleteExpense: (id) => {
    removedExpenses.add(id)
    return settle(undefined)
  },

  expenseCategories: () => settle([...categories]),
  saveExpenseCategories: (next) => {
    categories = [...next]
    return settle([...categories])
  },

  dayAudits: (storeIds, range) =>
    settle(storeIds.flatMap((id) => eachDay(range).map((day) => auditFor(id, day)))),

  pendingDeposits: (storeId) => {
    const base = startOfDay(new Date())
    const out: DayAudit[] = []
    for (let i = DEPOSIT_TIMELINE.pendingThrough; i >= 1; i--) {
      const day = dayKey(addDays(base, -i))
      const audit = auditFor(storeId, day)
      if (audit.status === "pending") out.push(audit)
    }
    return settle(out)
  },

  deposits: (storeId, range) => {
    const days = new Set(eachDay(range))
    return settle((recordedDeposits.get(storeId) ?? []).filter((d) => days.has(d.day)))
  },

  recordDeposit: (input) => {
    const expected = input.covers.reduce((sum, day) => sum + auditFor(input.storeId, day).expected, 0)
    const deposit: Deposit = {
      id: `dep-${Date.now().toString(36)}`,
      storeId: input.storeId,
      day: input.day,
      amount: input.amount,
      reference: input.reference,
      covers: [...input.covers],
      matched: input.amount === expected,
    }
    recordedDeposits.set(input.storeId, [deposit, ...(recordedDeposits.get(input.storeId) ?? [])])
    input.covers.forEach((day) => clearedDays.add(`${input.storeId}:${day}`))
    return settle(deposit)
  },

  posConnection: () =>
    settle({ connected: true, storesLinked: STORES.length, tokenHint: "4821" }),
  reconnectPos: () => settle(undefined),
  reconciliationRules: () => settle({ ...rules }),
  saveReconciliationRules: (next) => {
    rules = { ...next }
    return settle(undefined)
  },
}
