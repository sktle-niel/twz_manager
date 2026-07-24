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
]

export const OPEN_HOUR = 8
// Demand curve for the 12 open hours (8 AM through 7 PM):
// late-morning peak, midday lull, late-afternoon pickup
const HOUR_WEIGHT = [0.4, 0.75, 1.0, 1.1, 0.9, 0.7, 0.8, 1.0, 1.15, 1.05, 0.8, 0.5]

const BASE_DAILY: Record<string, number> = {
  arevalo: 46_000,
  molo: 31_500,
  jaro: 38_500,
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

export type ExpenseCategory = "Meals" | "Merienda" | "Other"

export type ExpenseItem = {
  id: string
  category: ExpenseCategory
  note: string
  amount: number
  time: string
}

const OTHER_NOTES = [
  "Tricycle fare, parts pickup",
  "Drinking water refill",
  "Cleaning supplies",
  "Receipt paper rolls",
]

/* Individual logged expenses for a day: staff meals + merienda, occasionally one more */
export function expenseItemsFor(storeId: string, date: Date): ExpenseItem[] {
  const rand = mulberry32(hashSeed(`exp:${storeId}:${dayKey(date)}`))
  const key = `${storeId}-${dayKey(date)}`
  const items: ExpenseItem[] = [
    {
      id: `${key}-lunch`,
      category: "Meals",
      note: "Staff lunch",
      amount: 220 + Math.round(rand() * 180),
      time: `11:${String(30 + Math.round(rand() * 25)).padStart(2, "0")} AM`,
    },
    {
      id: `${key}-merienda`,
      category: "Merienda",
      note: "Afternoon merienda",
      amount: 120 + Math.round(rand() * 140),
      time: `3:${String(10 + Math.round(rand() * 40)).padStart(2, "0")} PM`,
    },
  ]
  if (rand() > 0.72) {
    items.push({
      id: `${key}-other`,
      category: "Other",
      note: OTHER_NOTES[Math.floor(rand() * OTHER_NOTES.length)],
      amount: 250 + Math.round(rand() * 1400),
      time: `1:${String(10 + Math.round(rand() * 40)).padStart(2, "0")} PM`,
    })
  }
  return items
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
  status: DayStatus
}

/*
 * Reconciliation state of one audited day. Kept consistent with the
 * DepositsPage mock: the last two days are pending, days 3 and 4 back
 * were covered by one matched deposit, day 5 back was short by 180.
 */
export function dayAuditFor(storeId: string, date: Date): DayAudit {
  const gross = grossSalesFor(storeId, date)
  const expenses = expensesFor(storeId, date)
  const expected = gross - expenses
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000)

  if (diff <= 0) return { gross, expenses, expected, deposited: null, status: "open" }
  if (diff <= 2) return { gross, expenses, expected, deposited: null, status: "pending" }
  if (diff === 5) return { gross, expenses, expected, deposited: expected - 180, status: "discrepancy" }
  if (diff === 3 || diff === 4) return { gross, expenses, expected, deposited: expected, status: "matched" }

  const rand = mulberry32(hashSeed(`status:${storeId}:${dayKey(date)}`))
  if (rand() > 0.87) {
    const shortfall = 100 + Math.round(rand() * 400)
    return { gross, expenses, expected, deposited: expected - shortfall, status: "discrepancy" }
  }
  return { gross, expenses, expected, deposited: expected, status: "matched" }
}
