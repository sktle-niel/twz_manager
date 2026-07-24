/*
 * Shared date-range model used by the manager dashboard and the owner
 * overview, so both read from one source and never drift.
 */
import { shortDate } from "./format"
import { dayKey } from "./mock"

export type DateRange = { start: Date; end: Date }

export function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}
export function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}
export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b)
}
/* Sunday-anchored, matching the calendar grid the picker draws */
export function startOfWeek(d: Date): Date {
  const c = startOfDay(d)
  c.setDate(c.getDate() - c.getDay())
  return c
}
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
export function parseInputDate(v: string): Date | null {
  const [y, m, d] = v.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export type PresetKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "last7"
  | "last30"

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This week" },
  { key: "lastWeek", label: "Last week" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
]

export function presetRange(key: PresetKey, today: Date): DateRange {
  switch (key) {
    case "today":
      return { start: today, end: today }
    case "yesterday": {
      const y = addDays(today, -1)
      return { start: y, end: y }
    }
    case "thisWeek":
      return { start: startOfWeek(today), end: today }
    case "lastWeek": {
      const s = addDays(startOfWeek(today), -7)
      return { start: s, end: addDays(s, 6) }
    }
    case "thisMonth":
      return { start: startOfMonth(today), end: today }
    case "lastMonth": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return { start: s, end: endOfMonth(s) }
    }
    case "last7":
      return { start: addDays(today, -6), end: today }
    case "last30":
      return { start: addDays(today, -29), end: today }
  }
}

/* Keeps the chart readable and bounds the deterministic mock work */
const MAX_DAYS = 92

/* Every day in the range, never past today (today itself may be partial) */
export function rangeDays(range: DateRange, today: Date): Date[] {
  const end = range.end > today ? today : range.end
  const days: Date[] = []
  if (range.start > end) return days
  for (let d = range.start; d <= end && days.length < MAX_DAYS; d = addDays(d, 1)) {
    days.push(d)
  }
  return days
}

export function matchPreset(range: DateRange, today: Date): PresetKey | null {
  for (const p of PRESETS) {
    const r = presetRange(p.key, today)
    if (sameDay(r.start, range.start) && sameDay(r.end, range.end)) return p.key
  }
  return null
}

/* "Last 7 days" when the range matches a preset, otherwise "Jul 18 – Jul 24" */
export function rangeLabel(range: DateRange, today: Date): string {
  const key = matchPreset(range, today)
  if (key) return PRESETS.find((p) => p.key === key)?.label ?? ""
  if (sameDay(range.start, range.end)) return shortDate(range.start)
  return `${shortDate(range.start)} – ${shortDate(range.end)}`
}
