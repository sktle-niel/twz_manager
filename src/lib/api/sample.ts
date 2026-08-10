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
 * It behaves like the backend it stands in for: one identity per session,
 * writes validated and rejected with the same ApiError shape the HTTP adapter
 * throws, latency on every call. Nothing inside is reachable without signing
 * in — any password of 6+ characters is accepted for a known account. The
 * signed-in identity is kept in sessionStorage so a reload keeps the session
 * the way a real cookie would, and closing the tab ends it.
 *
 * Selected by VITE_DATA_SOURCE=sample; see src/lib/api/index.ts.
 */
import { addDays, dayKey, fromDayKey, startOfDay } from "../dateRange"
import { ApiError } from "./client"
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

/* Parts margin in the low thirties, wobbling per day like the real ledger
   does — profit is gross minus what the goods cost */
const marginFor = (day: string) => 0.3 + ((day.charCodeAt(8) + day.charCodeAt(9)) % 7) / 100

/* Pretend the network exists, so loading states are real during development */
const LATENCY = 120
const settle = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY))
const fail = (status: number, message: string, fields?: Record<string, string>): Promise<never> =>
  new Promise((_, reject) => setTimeout(() => reject(new ApiError(status, message, fields)), LATENCY))

/* Stands in for a stored photo, so receipt tiles render something honest */
const SAMPLE_PHOTO =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400"><rect width="320" height="400" fill="#f2f1ec"/><rect x="60" y="48" width="200" height="14" rx="3" fill="#d9d7ce"/><rect x="84" y="80" width="152" height="10" rx="3" fill="#e2e0d8"/><rect x="48" y="128" width="224" height="8" rx="2" fill="#e2e0d8"/><rect x="48" y="152" width="224" height="8" rx="2" fill="#e2e0d8"/><rect x="48" y="176" width="168" height="8" rx="2" fill="#e2e0d8"/><rect x="48" y="224" width="224" height="10" rx="2" fill="#d9d7ce"/><text x="160" y="330" text-anchor="middle" font-family="monospace" font-size="20" fill="#a8a69e">SAMPLE</text></svg>',
  )

/* ---- fixtures ---- */

const STORES: Store[] = [
  { id: "arevalo", name: "Arevalo" },
  { id: "molo", name: "Molo" },
  { id: "jaro", name: "Jaro" },
  { id: "lapaz", name: "La Paz" },
]

/* avatarKind is seed data the account holder can change on the Account page;
   girl is the system default for anyone who has not chosen */
let owner: Owner = {
  id: "owner",
  name: "Two Wheels Zone",
  username: "twowheelszone",
  photoUrl: null,
  avatarKind: "girl",
}

const SEED_MANAGERS: Manager[] = [
  {
    id: "m-arevalo",
    name: "Marvin Deocampo",
    username: "marvin.deocampo",
    storeId: "arevalo",
    active: true,
    photoUrl: null,
    avatarKind: "boy",
  },
  {
    id: "m-molo",
    name: "Joel Sarabia",
    username: "joel.sarabia",
    storeId: "molo",
    active: true,
    photoUrl: null,
    avatarKind: "boy",
  },
  {
    id: "m-jaro",
    name: "Rhea Villanueva",
    username: "rhea.villanueva",
    storeId: "jaro",
    active: true,
    photoUrl: null,
    avatarKind: "girl",
  },
  {
    id: "m-lapaz",
    name: "Test Account",
    username: "testaccount",
    storeId: "lapaz",
    active: true,
    photoUrl: null,
    avatarKind: "girl",
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
let rules = { batchWindowDays: 3 }

/* The signed-in identity, restored from sessionStorage so a reload behaves
   like a real session cookie: still signed in within the tab, signed out
   when the tab closes. Nobody is signed in until the form says so. */
const SESSION_KEY = "twz-sample-session"

function restoreSession(): Session {
  const id = sessionStorage.getItem(SESSION_KEY)
  if (id === owner.id) return { manager: null, owner }
  const manager = managers.find((m) => m.id === id) ?? null
  return { manager, owner: null }
}

let signedIn: Session = restoreSession()

/* The recovery PIN, mirroring the backend: the shipped 8017 until the owner
   changes it. The real one lives hashed in a settings table and is only ever
   compared against; here it sits in memory, which is as close as a mock gets
   and still refuses to hand itself back to the caller. */
const SHIPPED_PIN = "8017"
let resetPin = SHIPPED_PIN
let pinChangedAt: string | null = null

/* Passwords the owner has set from the admin side. Sample mode accepts any
   password of 6+ characters for a known account, so this only has to remember
   that a reset happened — enough to show the flow working end to end. */
const resetPasswords = new Map<string, string>()

/** Expenses added this session, and ids removed or edited, keyed by store:day */
const addedExpenses = new Map<string, ExpenseItem[]>()
const removedExpenses = new Set<string>()
const editedExpenses = new Map<string, Partial<ExpenseItem>>()
const recordedDeposits = new Map<string, Deposit[]>()
/** Days closed by a deposit recorded this session */
const clearedDays = new Set<string>()
/** Slip fingerprints of deposits recorded this session — the server-side half
    of the duplicate check the backend will own */
const slipShas = new Map<string, string>()

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

/** ISO instant for a wall-clock time on a sample day */
function instantOf(day: DayKey, hour: number, minute: number): string {
  const d = fromDayKey(day)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
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
  { id: "electric", day: 5, category: "Electric bill", min: 7_800, spread: 5_200, hour: 9, minute: 40 },
  { id: "water", day: 10, category: "Water bill", min: 780, spread: 620, hour: 10, minute: 15 },
  { id: "wifi", day: 15, category: "Wifi bill", min: 1_699, spread: 800, hour: 14, minute: 20 },
]

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
  const base = { storeId, day, receiptUrls: [] as string[] }

  if (spendLogged(storeId, day)) {
    items.push(
      {
        ...base,
        id: `${key}-lunch`,
        category: "Meals",
        note: "Staff lunch",
        amount: 220 + Math.round(rand() * 180),
        at: instantOf(day, 11, 30 + Math.round(rand() * 25)),
      },
      {
        ...base,
        id: `${key}-merienda`,
        category: "Merienda",
        note: "Afternoon merienda",
        amount: 120 + Math.round(rand() * 140),
        at: instantOf(day, 15, 10 + Math.round(rand() * 40)),
      },
    )
    if (rand() > 0.72) {
      items.push({
        ...base,
        id: `${key}-other`,
        category: "Other",
        note: OTHER_NOTES[Math.floor(rand() * OTHER_NOTES.length)],
        amount: 250 + Math.round(rand() * 1400),
        at: instantOf(day, 13, 10 + Math.round(rand() * 40)),
        receiptUrls: [SAMPLE_PHOTO],
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
      at: instantOf(day, bill.hour, bill.minute),
      receiptUrls: [SAMPLE_PHOTO],
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
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** One expense by id, from wherever it lives — needed to answer an update
    with the complete row the way a real backend would */
function expenseById(id: string): ExpenseItem | null {
  for (const list of addedExpenses.values()) {
    const hit = list.find((i) => i.id === id)
    if (hit) return { ...hit, ...(editedExpenses.get(id) ?? {}) }
  }
  // Generated ids carry their own coordinates: `${storeId}-${YYYY-MM-DD}-...`
  const m = /^([a-z]+)-(\d{4}-\d{2}-\d{2})-/.exec(id)
  if (!m) return null
  const hit = generatedExpenses(m[1], m[2]).find((i) => i.id === id)
  return hit ? { ...hit, ...(editedExpenses.get(id) ?? {}) } : null
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
  const profit = Math.round(gross * marginFor(day) * 100) / 100
  const expenses = expenseTotal(storeId, day)
  /* The house rule: what goes to the bank is profit minus the day's spend —
     the capital share of the takings stays in the shop to restock */
  const expected = Math.round((profit - expenses) * 100) / 100
  const diff = daysBack(day)
  const base = { storeId, day, gross, profit, expenses, expected }

  if (diff <= 0)
    return { ...base, deposited: null, reference: null, slipUrl: null, status: "open" }

  if (diff <= DEPOSIT_TIMELINE.pendingThrough) {
    if (!clearedDays.has(`${storeId}:${day}`))
      return { ...base, deposited: null, reference: null, slipUrl: null, status: "pending" }
    // Closed by a deposit recorded this session, whose slip photo we hold
    const covering = (recordedDeposits.get(storeId) ?? []).find((d) => d.covers.includes(day))
    return {
      ...base,
      deposited: expected,
      reference: covering?.reference ?? referenceFor(storeId, day),
      slipUrl: covering?.slipUrl ?? null,
      status: covering && !covering.matched ? "discrepancy" : "matched",
    }
  }

  if (diff === DEPOSIT_TIMELINE.shortDay) {
    return {
      ...base,
      deposited: expected - DEPOSIT_TIMELINE.shortfall,
      reference: referenceFor(storeId, day),
      slipUrl: SAMPLE_PHOTO,
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
      slipUrl: SAMPLE_PHOTO,
      status: "matched",
    }
  }

  const rand = mulberry32(hashSeed(`status:${storeId}:${day}`))
  const reference = referenceFor(storeId, day)
  if (rand() > 0.87) {
    const shortfall = 100 + Math.round(rand() * 400)
    return {
      ...base,
      deposited: expected - shortfall,
      reference,
      slipUrl: SAMPLE_PHOTO,
      status: "discrepancy" as DayStatus,
    }
  }
  return { ...base, deposited: expected, reference, slipUrl: SAMPLE_PHOTO, status: "matched" }
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
  session: () => settle({ ...signedIn }),

  signIn: (identifier, password) => {
    const id = identifier.trim().toLowerCase()
    if (password.length < 6) {
      return fail(401, "That username and password do not match.", {
        password: "That password is not right.",
      })
    }
    if (id === owner.username) {
      signedIn = { manager: null, owner }
      sessionStorage.setItem(SESSION_KEY, owner.id)
      return settle({ ...signedIn })
    }
    // Username only — accounts have no email to sign in with
    const found = managers.find((m) => m.username.toLowerCase() === id)
    if (!found) {
      return fail(401, "That username and password do not match.", {
        identifier: "No account matches this.",
      })
    }
    signedIn = { manager: found, owner: null }
    sessionStorage.setItem(SESSION_KEY, found.id)
    return settle({ ...signedIn })
  },

  signOut: () => {
    signedIn = { manager: null, owner: null }
    sessionStorage.removeItem(SESSION_KEY)
    return settle(undefined)
  },

  signIns: (accountId) => settle(signInLog(accountId)),

  setManagerPassword: (managerId, pin, password) => {
    if (pin !== resetPin) {
      return fail(422, "Check the highlighted fields.", { pin: "That is not the PIN." })
    }
    if (password.length < 8) {
      return fail(422, "Check the highlighted fields.", {
        password: "Password must be at least 8 characters.",
      })
    }
    const target = managers.find((m) => m.id === managerId)
    if (!target) return fail(404, "That account is no longer there.")
    resetPasswords.set(target.id, password)
    return settle(undefined)
  },

  resetPin: () =>
    settle({
      isDefault: resetPin === SHIPPED_PIN,
      length: 4,
      changedAt: pinChangedAt,
    }),

  changeResetPin: (currentPin, newPin) => {
    if (currentPin !== resetPin) {
      return fail(422, "Check the highlighted fields.", {
        currentPin: "That is not the current PIN.",
      })
    }
    if (!/^\d{4}$/.test(newPin)) {
      return fail(422, "Check the highlighted fields.", {
        newPin: "The PIN must be exactly 4 digits.",
      })
    }
    resetPin = newPin
    pinChangedAt = new Date().toISOString()
    return settle(undefined)
  },

  updateProfile: (input) => {
    const name = input.name.trim()
    const username = input.username.trim()
    const fields: Record<string, string> = {}
    if (!name) fields.name = "Enter the full name."
    if (!username) fields.username = "Enter a username."
    if (Object.keys(fields).length > 0) return fail(422, "Check the highlighted fields.", fields)

    const photoUrl = input.photo
      ? URL.createObjectURL(input.photo)
      : input.removePhoto
        ? null
        : (signedIn.manager?.photoUrl ?? signedIn.owner?.photoUrl ?? null)

    if (signedIn.manager) {
      const updated = {
        ...signedIn.manager,
        name,
        username,
        photoUrl,
        avatarKind: input.avatarKind,
      }
      managers = managers.map((m) => (m.id === updated.id ? updated : m))
      signedIn = { manager: updated, owner: null }
    } else if (signedIn.owner) {
      owner = { ...owner, name, username, photoUrl, avatarKind: input.avatarKind }
      signedIn = { manager: null, owner }
    } else {
      return fail(401, "Your session has expired. Sign in again.")
    }
    return settle({ ...signedIn })
  },

  changePassword: (current, next) => {
    if (!current) {
      return fail(422, "Check the highlighted fields.", {
        current: "Enter your current password.",
      })
    }
    if (next.length < 8) {
      return fail(422, "Check the highlighted fields.", {
        next: "Password must be at least 8 characters.",
      })
    }
    return settle(undefined)
  },

  stores: () => settle(STORES),
  managers: () => settle([...managers]),

  issueManager: (input) => {
    const username = input.username.trim().toLowerCase()
    const fields: Record<string, string> = {}
    if (!input.name.trim()) fields.name = "Enter the manager's full name."
    if (!username) fields.username = "Enter a username."
    else if (!/^[a-z0-9._-]+$/.test(username))
      fields.username = "Letters, numbers, dots, dashes and underscores only."
    else if (username === owner.username || managers.some((m) => m.username.toLowerCase() === username))
      fields.username = "That username is taken."
    if (input.password.length < 8) fields.password = "Password must be at least 8 characters."
    if (Object.keys(fields).length > 0) return fail(422, "Check the highlighted fields.", fields)

    const created: Manager = {
      id: `m-${Date.now().toString(36)}`,
      name: input.name.trim(),
      username,
      storeId: input.storeId,
      active: true,
      photoUrl: null,
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
        const profit = Math.round(gross * marginFor(day) * 100) / 100
        rows.push({
          storeId,
          day,
          gross,
          profit,
          expenses,
          expected: Math.round((profit - expenses) * 100) / 100,
        })
      }
    }
    return settle(rows)
  },

  hourlySales: (storeIds, day) => {
    /* Profit per hour, like the real endpoint — the charts draw kita */
    const margin = marginFor(day)
    const perStore = storeIds.map((id) => hourlyFor(id, day))
    const length = perStore[0]?.length ?? 0
    return settle(
      Array.from({ length }, (_, i) => ({
        hour: perStore[0][i].hour,
        amount:
          Math.round(
            perStore.reduce((sum, list) => sum + (list[i]?.amount ?? 0), 0) * margin * 100,
          ) / 100,
      })),
    )
  },

  expenses: (storeId, range) =>
    settle(eachDay(range).flatMap((day) => expensesFor(storeId, day))),

  addExpenses: (items) => {
    for (const item of items) {
      if (!(item.amount > 0)) return fail(422, "Every expense needs an amount above zero.")
      if (!categories.some((c) => c.name === item.category))
        return fail(422, `${item.category} is not a category anymore.`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.day))
        return fail(422, "That day is not a valid date.")
    }
    const created = items.map((item, i) => ({
      id: `local-${Date.now().toString(36)}-${i}`,
      storeId: item.storeId,
      day: item.day,
      category: item.category,
      note: item.note,
      amount: item.amount,
      at: new Date().toISOString(),
      receiptUrls: item.receipts.map((f) => URL.createObjectURL(f)),
    }))
    for (const item of created) {
      const key = `${item.storeId}:${item.day}`
      addedExpenses.set(key, [...(addedExpenses.get(key) ?? []), item])
    }
    return settle(created)
  },

  updateExpense: (id, patch) => {
    const existing = expenseById(id)
    if (!existing) return fail(404, "That expense is no longer there.")
    if (patch.amount !== undefined && !(patch.amount > 0))
      return fail(422, "Check the highlighted fields.", { amount: "Enter an amount above zero." })
    const next: Partial<ExpenseItem> = {
      ...(editedExpenses.get(id) ?? {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.receipts !== undefined
        ? {
            receiptUrls: [
              ...patch.receipts.keep,
              ...patch.receipts.add.map((f) => URL.createObjectURL(f)),
            ],
          }
        : {}),
    }
    editedExpenses.set(id, next)
    return settle({ ...existing, ...next })
  },

  deleteExpense: (id) => {
    removedExpenses.add(id)
    return settle(undefined)
  },

  expenseCategories: () => settle([...categories]),
  saveExpenseCategories: (next) => {
    const names = next.map((c) => c.name.trim().toLowerCase())
    if (names.some((n) => !n)) return fail(422, "A category cannot be blank.")
    if (new Set(names).size !== names.length)
      return fail(422, "Two categories cannot share a name.")
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day))
      return fail(422, "Check the highlighted fields.", { day: "Enter the deposit date." })
    if (!(input.amount > 0))
      return fail(422, "Check the highlighted fields.", { amount: "Enter an amount above zero." })
    if (!input.reference.trim())
      return fail(422, "Check the highlighted fields.", { reference: "Enter the reference number." })
    if (input.covers.length === 0)
      return fail(422, "Select at least one day this deposit covers.")
    const duplicate =
      input.slipSha &&
      [...recordedDeposits.values()].flat().some((d) => slipShas.get(d.id) === input.slipSha)
    if (duplicate) {
      return fail(409, "This slip photo already covers a deposit.", {
        slip: "This exact photo was already filed. Take a fresh photo of the right slip.",
      })
    }
    const expected = input.covers.reduce(
      (sum, day) => sum + auditFor(input.storeId, day).expected,
      0,
    )
    const deposit: Deposit = {
      id: `dep-${Date.now().toString(36)}`,
      storeId: input.storeId,
      day: input.day,
      amount: input.amount,
      reference: input.reference,
      covers: [...input.covers],
      slipUrl: URL.createObjectURL(input.slip),
      matched: Math.round(input.amount * 100) === Math.round(expected * 100),
    }
    if (input.slipSha) slipShas.set(deposit.id, input.slipSha)
    recordedDeposits.set(input.storeId, [deposit, ...(recordedDeposits.get(input.storeId) ?? [])])
    input.covers.forEach((day) => clearedDays.add(`${input.storeId}:${day}`))
    return settle(deposit)
  },

  posConnection: () =>
    settle({ connected: true, storesLinked: STORES.length, tokenHint: "4821" }),
  reconnectPos: () => settle(undefined),
  reconciliationRules: () => settle({ ...rules }),
  saveReconciliationRules: (next) => {
    if (!Number.isInteger(next.batchWindowDays) || next.batchWindowDays < 1 || next.batchWindowDays > 14)
      return fail(422, "The batching window must be between 1 and 14 days.")
    rules = { batchWindowDays: next.batchWindowDays }
    return settle(undefined)
  },
}
