import { addDays } from "./dateRange"
import type { DayStatus } from "./api"
import type { HistoryEntry } from "./historyGroups"

/*
 * The filter vocabulary both History pages share — one definition, so the
 * manager's and the owner's views can never drift apart on what "Last month"
 * or "Completed" means.
 */
export type RangePreset = "last7" | "last30" | "last90" | "thisMonth" | "lastMonth" | "thisYear"
export type StatusFilter = "all" | DayStatus
export type HistoryTab = "all" | "completed" | "uncompleted"

export const HISTORY_RANGES: { value: RangePreset; label: string }[] = [
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
]

export const HISTORY_STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "matched", label: "Matched" },
  { value: "discrepancy", label: "Discrepancy" },
  { value: "pending", label: "Pending deposit" },
  { value: "open", label: "Open" },
]

export const HISTORY_TABS: { value: HistoryTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "uncompleted", label: "Uncompleted" },
]

/** The preset's inclusive start and end, relative to the given today */
export function presetBounds(preset: RangePreset, today: Date): { start: Date; end: Date } {
  switch (preset) {
    case "last7":
      return { start: addDays(today, -6), end: today }
    case "last30":
      return { start: addDays(today, -29), end: today }
    case "last90":
      return { start: addDays(today, -89), end: today }
    case "thisMonth":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }
    case "lastMonth":
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        end: new Date(today.getFullYear(), today.getMonth(), 0),
      }
    case "thisYear":
      return { start: new Date(today.getFullYear(), 0, 1), end: today }
  }
}

/** A deposit already answers this day — recorded, matched or not */
export function isCompleted(status: DayStatus): boolean {
  return status === "matched" || status === "discrepancy"
}

/** The tab scope and the status dropdown, applied together */
export function filterEntries(
  entries: HistoryEntry[],
  tab: HistoryTab,
  status: StatusFilter,
): HistoryEntry[] {
  return entries
    .filter(
      (e) =>
        tab === "all" ||
        (tab === "completed" ? isCompleted(e.audits[0].status) : !isCompleted(e.audits[0].status)),
    )
    .filter((e) => status === "all" || e.audits[0].status === status)
}

/** Status counts across the whole range, one per entry (a batch counts once) */
export function countEntries(entries: HistoryEntry[]): Record<DayStatus, number> {
  const counts: Record<DayStatus, number> = { matched: 0, discrepancy: 0, pending: 0, open: 0 }
  for (const e of entries) counts[e.audits[0].status]++
  return counts
}
