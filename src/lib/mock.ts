/*
 * Deterministic mock data for UI development only.
 * Every figure here is sample data seeded from the store id + date,
 * so the same day always shows the same numbers. Replaced by the
 * Loyverse POS integration once the backend exists.
 */

export type Store = { id: string; name: string }

export const STORES: Store[] = [
  { id: "arevalo", name: "Arevalo" },
  { id: "molo", name: "Molo" },
  { id: "jaro", name: "Jaro" },
  { id: "lapaz", name: "La Paz" },
]

export type Manager = {
  id: string
  name: string
  username: string
  email: string
  storeId: string
  active: boolean
}

/* Branch manager accounts issued by the owner (sample data until auth exists) */
export const MANAGERS: Manager[] = [
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

export const OPEN_HOUR = 8
// Demand curve for the 12 open hours (8 AM through 7 PM):
// late-morning peak, midday lull, late-afternoon pickup
const HOUR_WEIGHT = [0.4, 0.75, 1.0, 1.1, 0.9, 0.7, 0.8, 1.0, 1.15, 1.05, 0.8, 0.5]

const BASE_DAILY: Record<string, number> = {
  arevalo: 46_000,
  molo: 31_500,
  jaro: 38_500,
  lapaz: 35_000,
}

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

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export function isToday(d: Date): boolean {
  return dayKey(d) === dayKey(new Date())
}

export type HourPoint = { hour: number; amount: number }

/* Full-day hourly gross sales for one store */
export function hourlySalesFor(storeId: string, date: Date): HourPoint[] {
  const rand = mulberry32(hashSeed(`${storeId}:${dayKey(date)}`))
  const base = BASE_DAILY[storeId] ?? 30_000
  const dow = date.getDay()
  const dowFactor = dow === 0 ? 0.55 : dow === 6 ? 1.2 : 1
  const dayFactor = dowFactor * (0.8 + rand() * 0.45)
  const weightSum = HOUR_WEIGHT.reduce((a, b) => a + b, 0)
  return HOUR_WEIGHT.map((w, i) => {
    const jitter = 0.7 + rand() * 0.6
    return {
      hour: OPEN_HOUR + i,
      amount: Math.round((base * dayFactor * w * jitter) / weightSum),
    }
  })
}

/* Hourly sales cut off at the current hour when the date is today */
export function visibleHourlySales(storeId: string, date: Date): HourPoint[] {
  const all = hourlySalesFor(storeId, date)
  if (!isToday(date)) return all
  const nowHour = new Date().getHours()
  return all.filter((p) => p.hour <= nowHour)
}

/* Gross sales for a day (partial when the day is today) */
export function grossSalesFor(storeId: string, date: Date): number {
  return visibleHourlySales(storeId, date).reduce((sum, p) => sum + p.amount, 0)
}

export type ExpenseCategory =
  | "Meals"
  | "Merienda"
  | "Water bill"
  | "Electric bill"
  | "Wifi bill"
  | "Other"

export type ExpenseItem = {
  id: string
  category: ExpenseCategory
  note: string
  amount: number
  time: string
  /* How many receipt photos are on file. Meals and merienda are company-covered
     and logged without any; every other category carries at least one. */
  receiptCount: number
  /* The actual files, only for rows attached in this session — mock rows just
     record how many exist, since there is nothing stored to hand back. */
  receipts?: File[]
}

const OTHER_NOTES = [
  "Tricycle fare, parts pickup",
  "Drinking water refill",
  "Cleaning supplies",
  "Receipt paper rolls",
]

/* Utility bills arrive once a month on a fixed day, per branch */
const MONTHLY_BILLS: {
  id: string
  day: number
  category: ExpenseCategory
  min: number
  spread: number
  time: string
}[] = [
  { id: "electric", day: 5, category: "Electric bill", min: 7_800, spread: 5_200, time: "9:40 AM" },
  { id: "water", day: 10, category: "Water bill", min: 780, spread: 620, time: "10:15 AM" },
  { id: "wifi", day: 15, category: "Wifi bill", min: 1_699, spread: 800, time: "2:20 PM" },
]

/* "3:05 PM" -> minutes past midnight, so a day's log reads in order */
function minutesOfDay(time: string): number {
  const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(time)
  if (!m) return 0
  const hour = Number(m[1]) % 12
  return (hour + (/pm/i.test(m[3]) ? 12 : 0)) * 60 + Number(m[2])
}

/*
 * This many days back, the branch never logged its daily spend at all — the
 * sample's "manager forgot" case, so the Expenses page has a real gap to flag
 * while the day is still open for editing. Older days fall back to a seeded
 * chance, so History shows the same situation now and then.
 */
const UNLOGGED_DAY = 4

function dailySpendLogged(storeId: string, date: Date): boolean {
  const diff = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000,
  )
  if (diff === UNLOGGED_DAY) return false
  if (diff <= DEPOSIT_TIMELINE.pendingThrough) return true
  return mulberry32(hashSeed(`logged:${storeId}:${dayKey(date)}`))() > 0.1
}

/*
 * Individual logged expenses for a day: staff meals + merienda and sometimes
 * one more, plus any utility bill falling on that date. A day the branch never
 * logged returns only its bills — possibly nothing at all.
 */
export function expenseItemsFor(storeId: string, date: Date): ExpenseItem[] {
  const rand = mulberry32(hashSeed(`exp:${storeId}:${dayKey(date)}`))
  const key = `${storeId}-${dayKey(date)}`
  const items: ExpenseItem[] = []

  if (dailySpendLogged(storeId, date)) {
    items.push(
      {
        id: `${key}-lunch`,
        category: "Meals",
        note: "Staff lunch",
        amount: 220 + Math.round(rand() * 180),
        time: `11:${String(30 + Math.round(rand() * 25)).padStart(2, "0")} AM`,
        receiptCount: 0,
      },
      {
        id: `${key}-merienda`,
        category: "Merienda",
        note: "Afternoon merienda",
        amount: 120 + Math.round(rand() * 140),
        time: `3:${String(10 + Math.round(rand() * 40)).padStart(2, "0")} PM`,
        receiptCount: 0,
      },
    )
    if (rand() > 0.72) {
      items.push({
        id: `${key}-other`,
        category: "Other",
        note: OTHER_NOTES[Math.floor(rand() * OTHER_NOTES.length)],
        amount: 250 + Math.round(rand() * 1400),
        time: `1:${String(10 + Math.round(rand() * 40)).padStart(2, "0")} PM`,
        receiptCount: 1,
      })
    }
  }

  // Seeded separately from the daily spend so adding bills never shifts it
  const billRand = mulberry32(hashSeed(`bill:${storeId}:${dayKey(date)}`))
  const period = new Date(date.getFullYear(), date.getMonth() - 1, 1).toLocaleDateString("en-US", {
    month: "long",
  })
  for (const bill of MONTHLY_BILLS) {
    if (date.getDate() !== bill.day) continue
    items.push({
      id: `${key}-${bill.id}`,
      category: bill.category,
      note: `${period} billing period`,
      amount: bill.min + Math.round(billRand() * bill.spread),
      time: bill.time,
      receiptCount: 1,
    })
  }

  return items.sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time))
}

/* Total logged expenses for a day */
export function expensesFor(storeId: string, date: Date): number {
  return expenseItemsFor(storeId, date).reduce((sum, item) => sum + item.amount, 0)
}

/* Expected bank deposit for one audited day */
export function expectedDepositFor(storeId: string, date: Date): number {
  return grossSalesFor(storeId, date) - expensesFor(storeId, date)
}

export type DayStatus = "open" | "pending" | "matched" | "discrepancy"

export type DayAudit = {
  gross: number
  expenses: number
  expected: number
  deposited: number | null
  /* Bank reference of the covering deposit; null until the day is deposited */
  reference: string | null
  status: DayStatus
}

function referenceFor(storeId: string, key: string): string {
  const rand = mulberry32(hashSeed(`ref:${storeId}:${key}`))
  return String(Math.floor(rand() * 1_000_000)).padStart(6, "0")
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

/*
 * Shape of the sample reconciliation timeline, in days back from today.
 * Deposits, History, and the audit views all read these, so a branch that
 * has not deposited in a while shows the same backlog everywhere.
 */
export const DEPOSIT_TIMELINE = {
  /* Days 1..6 are audited but still waiting for a deposit — a branch that has
     run past the usual 3-day batching window */
  pendingThrough: 6,
  /* One deposit covered these two days, oldest first */
  matchedPair: [8, 7],
  /* This day's deposit came up short */
  shortDay: 9,
  shortfall: 180,
}

/* Reconciliation state of one audited day */
export function dayAuditFor(storeId: string, date: Date): DayAudit {
  const gross = grossSalesFor(storeId, date)
  const expenses = expensesFor(storeId, date)
  const expected = gross - expenses
  const diff = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000,
  )

  if (diff <= 0)
    return { gross, expenses, expected, deposited: null, reference: null, status: "open" }
  if (diff <= DEPOSIT_TIMELINE.pendingThrough)
    return { gross, expenses, expected, deposited: null, reference: null, status: "pending" }
  if (diff === DEPOSIT_TIMELINE.shortDay)
    return {
      gross,
      expenses,
      expected,
      deposited: expected - DEPOSIT_TIMELINE.shortfall,
      reference: referenceFor(storeId, dayKey(date)),
      status: "discrepancy",
    }
  if (DEPOSIT_TIMELINE.matchedPair.includes(diff)) {
    // Both days were covered by one deposit, so they carry the same reference
    const newer = addDays(date, diff - DEPOSIT_TIMELINE.matchedPair[1])
    return {
      gross,
      expenses,
      expected,
      deposited: expected,
      reference: referenceFor(storeId, `pair:${dayKey(newer)}`),
      status: "matched",
    }
  }

  const rand = mulberry32(hashSeed(`status:${storeId}:${dayKey(date)}`))
  const reference = referenceFor(storeId, dayKey(date))
  if (rand() > 0.87) {
    const shortfall = 100 + Math.round(rand() * 400)
    return {
      gross,
      expenses,
      expected,
      deposited: expected - shortfall,
      reference,
      status: "discrepancy",
    }
  }
  return { gross, expenses, expected, deposited: expected, reference, status: "matched" }
}

/*
 * Every audited day still waiting for a bank deposit, oldest first. Derived
 * from dayAuditFor rather than assuming a fixed number of days, so however
 * long a branch goes without depositing, all of it surfaces.
 */
export function pendingDepositDays(storeId: string, today: Date): Date[] {
  const base = startOfDay(today)
  const days: Date[] = []
  for (let i = DEPOSIT_TIMELINE.pendingThrough; i >= 1; i--) {
    const d = addDays(base, -i)
    if (dayAuditFor(storeId, d).status === "pending") days.push(d)
  }
  return days
}

export type SignInDeviceKind = "phone" | "computer"

export type SignInEvent = {
  id: string
  device: string
  platform: string
  kind: SignInDeviceKind
  ip: string
  place: string
  at: Date
  /* The session reading the page right now */
  current: boolean
}

/*
 * Which devices have opened one manager's account. Seeded from the account id
 * like every other figure here, so a manager always sees the same history.
 * The real list will come from the auth backend's session records — device,
 * IP, and time are exactly what it will hand back.
 */
const SIGN_IN_DEVICES: { device: string; platform: string; kind: SignInDeviceKind }[] = [
  { device: "Realme 6", platform: "Android 11 · Chrome 124", kind: "phone" },
  { device: "Windows laptop", platform: "Windows 11 · Edge 126", kind: "computer" },
  { device: "Redmi Note 12", platform: "Android 13 · Chrome 125", kind: "phone" },
  { device: "iPhone 11", platform: "iOS 17 · Safari", kind: "phone" },
]

const SIGN_IN_IPS = ["112.198.104.77", "180.190.23.14", "119.94.61.202", "203.177.42.9"]
/* Coarse GeoIP areas, deliberately not branch names — where a device signed
   in from says nothing about which branch the account belongs to */
const SIGN_IN_PLACES = ["Iloilo City, PH", "Mandurriao, Iloilo", "Pavia, Iloilo", "Oton, Iloilo"]

export function signInLogFor(managerId: string, now: Date): SignInEvent[] {
  const rand = mulberry32(hashSeed(`signin:${managerId}`))
  const start = Math.floor(rand() * SIGN_IN_DEVICES.length)
  /*
   * Minutes between one sign-in and the next, walking back from now: the
   * current session first, then the sign-in from another device a few hours
   * before it — recent enough that the dashboard still calls it out.
   */
  const gaps = [
    25 + Math.round(rand() * 150),
    4 * 60 + Math.round(rand() * 600),
    26 * 60 + Math.round(rand() * 900),
    50 * 60 + Math.round(rand() * 1200),
  ]

  let minutes = 0
  return SIGN_IN_DEVICES.map((_, i) => {
    minutes += gaps[i]
    const slot = (start + i) % SIGN_IN_DEVICES.length
    const device = SIGN_IN_DEVICES[slot]
    return {
      id: `${managerId}-signin-${i}`,
      device: device.device,
      platform: device.platform,
      kind: device.kind,
      ip: SIGN_IN_IPS[slot],
      place: SIGN_IN_PLACES[slot],
      at: new Date(now.getTime() - minutes * 60_000),
      current: i === 0,
    }
  })
}
