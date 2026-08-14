/*
 * The presentation half of the global search. The matching itself lives on
 * the backend now (GET /search, docs/API.md): every token must appear
 * somewhere in a record's haystack, and a recognised date narrows by the
 * record's own day. What comes back are raw wire shapes, grouped and capped
 * with true totals — this file turns them into the records the overlay
 * renders, and keeps the query-parsing helpers the sample adapter still
 * mirrors the server with.
 */
import { clockLabel, peso, rowDate, shortDate } from "./format"
import type { DayStatus, Deposit, ExpenseItem, Manager, SearchResults, Store } from "./api/types"
import { fromDayKey } from "./dateRange"

/* What the backend's window covers, so the overlay can say it out loud.
   Kept in lockstep with the server's GlobalSearch::WINDOW_DAYS. */
export const WINDOW_DAYS = 90

/* Below this the backend answers 422, so the overlay does not even ask */
export const SEARCH_MIN = 2

export type SearchKind = "day" | "expense" | "deposit" | "manager" | "branch"

export const KIND_LABEL: Record<SearchKind, string> = {
  day: "Audited days",
  expense: "Expenses",
  deposit: "Deposits",
  manager: "Managers",
  branch: "Branches",
}

export const STATUS_LABEL: Record<DayStatus, string> = {
  open: "Open",
  pending: "Pending deposit",
  matched: "Matched",
  discrepancy: "Discrepancy",
}

export type DetailRow = { label: string; value: string; tone?: "bad" | "good" }

export type SearchRecord = {
  id: string
  kind: SearchKind
  title: string
  subtitle: string
  meta?: string
  details: DetailRow[]
  to: string
  toLabel: string
}

export type SearchRoutes = Record<SearchKind, { to: string; label: string }>

export type SearchScope = {
  /* The branches the caller may see; names label the records client-side */
  stores: Store[]
  routes: SearchRoutes
}

export const MANAGER_ROUTES: SearchRoutes = {
  day: { to: "/history", label: "Open in History" },
  expense: { to: "/expenses", label: "Open in Expenses" },
  deposit: { to: "/deposits", label: "Open in Deposits" },
  manager: { to: "/account", label: "Open Account" },
  branch: { to: "/account", label: "Open Account" },
}

/* The owner area has no expense or deposit page of its own, so those results
   point at the nearest place the same figures appear */
export const OWNER_ROUTES: SearchRoutes = {
  day: { to: "/admin/history", label: "Open in History" },
  expense: { to: "/admin", label: "Open in Overview" },
  deposit: { to: "/admin/history", label: "Open in History" },
  manager: { to: "/admin/managers", label: "Open in Managers" },
  branch: { to: "/admin/settings", label: "Open in Settings" },
}

export type SearchGroup = {
  kind: SearchKind
  label: string
  items: SearchRecord[]
  /* Everything that matched, so a truncated group can say how much it is hiding */
  total: number
}

/** Turns the backend's grouped wire shapes into the records the overlay renders */
export function buildGroups(results: SearchResults, scope: SearchScope): SearchGroup[] {
  const name = (storeId: string) =>
    scope.stores.find((s) => s.id === storeId)?.name ?? storeId
  const { routes } = scope

  const groups: SearchGroup[] = [
    {
      kind: "day",
      label: KIND_LABEL.day,
      total: results.days.total,
      items: results.days.items.map((audit) => {
        const d = fromDayKey(audit.day)
        const answered =
          audit.deposited === null ? null : audit.deposited + (audit.online ?? 0)
        const judged =
          audit.depositExpected ??
          ((audit.depositCovers?.length ?? 0) > 1 ? null : audit.expected)
        const shortfall =
          answered !== null && judged !== null && answered < judged ? judged - answered : 0
        const overage =
          answered !== null && judged !== null && answered > judged ? answered - judged : 0
        /* Over is a discrepancy on the wire, but it wears green and its own
           word everywhere the reader sees it */
        const over = audit.status === "discrepancy" && overage > 0
        const status = over ? "Over" : STATUS_LABEL[audit.status]

        return {
          id: `day-${audit.storeId}-${audit.day}`,
          kind: "day" as const,
          title: rowDate(d),
          subtitle: `${name(audit.storeId)} · ${status}`,
          meta: peso.format(audit.expected),
          details: [
            { label: "Branch", value: name(audit.storeId) },
            {
              label: "Status",
              value: status,
              tone:
                audit.status === "discrepancy" && !over
                  ? ("bad" as const)
                  : audit.status === "matched" || over
                    ? ("good" as const)
                    : undefined,
            },
            { label: "Gross profit", value: peso.format(audit.profit) },
            { label: "Expenses", value: peso.format(audit.expenses) },
            ...(audit.advances > 0
              ? [{ label: "Advances", value: peso.format(audit.advances) }]
              : []),
            { label: "Expected deposit", value: peso.format(audit.expected) },
            {
              label: "Deposited",
              value: audit.deposited === null ? "Not yet" : peso.format(audit.deposited),
            },
            ...(shortfall > 0
              ? [{ label: "Short by", value: peso.format(shortfall), tone: "bad" as const }]
              : []),
            ...(overage > 0
              ? [{ label: "Over by", value: peso.format(overage), tone: "good" as const }]
              : []),
            ...(audit.reference ? [{ label: "Reference", value: audit.reference }] : []),
          ],
          to: routes.day.to,
          toLabel: routes.day.label,
        }
      }),
    },
    {
      kind: "expense",
      label: KIND_LABEL.expense,
      total: results.expenses.total,
      items: results.expenses.items.map((item: ExpenseItem) => {
        const d = fromDayKey(item.day)

        return {
          id: `expense-${item.id}`,
          kind: "expense" as const,
          title: item.note,
          subtitle: `${item.category} · ${name(item.storeId)} · ${rowDate(d)}`,
          meta: peso.format(item.amount),
          details: [
            { label: "Category", value: item.category },
            { label: "Branch", value: name(item.storeId) },
            { label: "Day", value: rowDate(d) },
            { label: "Logged at", value: clockLabel(new Date(item.at)) },
            { label: "Amount", value: peso.format(item.amount) },
            {
              label: "Receipts",
              value:
                item.receiptUrls.length === 0
                  ? "None (company-covered)"
                  : `${item.receiptUrls.length} on file`,
            },
          ],
          to: routes.expense.to,
          toLabel: routes.expense.label,
        }
      }),
    },
    {
      kind: "deposit",
      label: KIND_LABEL.deposit,
      total: results.deposits.total,
      items: results.deposits.items.map((dep: Deposit) => {
        const days = dep.covers.map(fromDayKey)
        const covers =
          days.length === 1
            ? rowDate(days[0])
            : `${shortDate(days[0])} - ${shortDate(days[days.length - 1])}`
        const answered = dep.amount + dep.online
        const short =
          !dep.matched && dep.expected !== null && answered < dep.expected
            ? dep.expected - answered
            : 0
        const overage =
          !dep.matched && dep.expected !== null && answered > dep.expected
            ? answered - dep.expected
            : 0

        return {
          id: `deposit-${dep.id}`,
          kind: "deposit" as const,
          title: `Deposit ${dep.reference}`,
          subtitle: `${name(dep.storeId)} · covers ${covers}`,
          meta: peso.format(dep.amount),
          details: [
            { label: "Branch", value: name(dep.storeId) },
            { label: "Reference", value: dep.reference },
            {
              label: "Status",
              value: dep.matched ? "Matched" : overage > 0 ? "Over" : "Discrepancy",
              tone: dep.matched || overage > 0 ? ("good" as const) : ("bad" as const),
            },
            { label: "Deposited", value: peso.format(dep.amount) },
            ...(dep.online > 0
              ? [{ label: "Declared online", value: peso.format(dep.online) }]
              : []),
            ...(dep.expected !== null
              ? [{ label: "Expected", value: peso.format(dep.expected) }]
              : []),
            ...(short > 0
              ? [{ label: "Short by", value: peso.format(short), tone: "bad" as const }]
              : []),
            ...(overage > 0
              ? [{ label: "Over by", value: peso.format(overage), tone: "good" as const }]
              : []),
            {
              label: days.length === 1 ? "Covers" : `Covers ${days.length} days`,
              value: days.map((d) => shortDate(d)).join(", "),
            },
          ],
          to: routes.deposit.to,
          toLabel: routes.deposit.label,
        }
      }),
    },
    {
      kind: "manager",
      label: KIND_LABEL.manager,
      total: results.managers.total,
      items: results.managers.items.map((m: Manager) => ({
        id: `manager-${m.id}`,
        kind: "manager" as const,
        title: m.name,
        subtitle: `${m.username} · ${name(m.storeId)}`,
        details: [
          { label: "Name", value: m.name },
          { label: "Username", value: m.username },
          { label: "Branch", value: name(m.storeId) },
          {
            label: "Account",
            value: m.active ? "Active" : "Disabled",
            tone: m.active ? ("good" as const) : ("bad" as const),
          },
        ],
        to: routes.manager.to,
        toLabel: routes.manager.label,
      })),
    },
    {
      kind: "branch",
      label: KIND_LABEL.branch,
      total: results.branches.total,
      items: results.branches.items.map((b) => ({
        id: `branch-${b.id}`,
        kind: "branch" as const,
        title: b.name,
        subtitle: b.managerName ? `Managed by ${b.managerName}` : "No manager assigned",
        details: [
          { label: "Branch", value: b.name },
          { label: "Manager", value: b.managerName ?? "None assigned" },
          { label: "POS", value: "Loyverse-linked", tone: "good" as const },
        ],
        to: routes.branch.to,
        toLabel: routes.branch.label,
      })),
    },
  ]

  return groups.filter((g) => g.total > 0)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Query parsing — used only by the SAMPLE adapter, which mirrors the server's
 * matching so demo mode behaves like production. The real matching runs in
 * the backend's App\Support\GlobalSearch; keep the two in lockstep.
 * ──────────────────────────────────────────────────────────────────────────── */

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]

export type DateHint = { year?: number; month?: number; day?: number }

/*
 * Splits a query into a date and whatever else was typed. A recognised date
 * filters on the record's own day; only the leftover words stay substring
 * matches — which is what makes "meals july 3" mean meals ON that day. Bare
 * numbers become a day or a year only when a month was named; on their own
 * they stay ordinary tokens, so "480" and "712063" still find an amount and
 * a deposit reference.
 */
export function parseQuery(raw: string): { hint: DateHint | null; tokens: string[] } {
  const words = raw.trim().toLowerCase().replace(/,/g, " ").split(/\s+/).filter(Boolean)
  const hint: DateHint = {}
  const loose: string[] = []
  const numbers: string[] = []
  let dated = false

  for (const w of words) {
    const iso = /^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/.exec(w)
    if (iso) {
      hint.year = +iso[1]
      hint.month = +iso[2] - 1
      if (iso[3]) hint.day = +iso[3]
      dated = true
      continue
    }

    const slashed = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(w)
    if (slashed) {
      hint.month = +slashed[1] - 1
      hint.day = +slashed[2]
      if (slashed[3]) hint.year = slashed[3].length === 2 ? 2000 + +slashed[3] : +slashed[3]
      dated = true
      continue
    }

    // A month name, or enough of one to be unambiguous ("jul", "sept")
    const month = w.length >= 3 ? MONTHS.findIndex((m) => m.startsWith(w)) : -1
    if (month >= 0) {
      hint.month = month
      dated = true
      continue
    }

    if (/^\d{4}$/.test(w) || /^\d{1,2}(st|nd|rd|th)?$/.test(w)) {
      numbers.push(w)
      continue
    }

    loose.push(w)
  }

  if (!dated) return { hint: null, tokens: [...loose, ...numbers] }

  for (const n of numbers) {
    if (/^\d{4}$/.test(n)) hint.year = +n
    else if (hint.day === undefined) hint.day = parseInt(n, 10)
    else loose.push(n)
  }

  return { hint, tokens: loose }
}

/** Whether any of the given `YYYY-MM-DD` days satisfies the date hint */
export function hintHitsDays(hint: DateHint, days: string[]): boolean {
  return days.some((day) => {
    const d = fromDayKey(day)
    if (hint.year !== undefined && d.getFullYear() !== hint.year) return false
    if (hint.month !== undefined && d.getMonth() !== hint.month) return false
    if (hint.day !== undefined && d.getDate() !== hint.day) return false
    return true
  })
}

/** Every way a reader might write this day, so a query like "july" reaches it */
export function dateWords(day: string): string {
  const d = fromDayKey(day)
  return [
    rowDate(d),
    MONTHS[d.getMonth()],
    d.getDate(),
    d.getFullYear(),
    day,
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`,
  ].join(" ")
}

/** "over" or "short", so those words find a deposit the way the UI names it */
export function signWord(
  deposited: number | null,
  online: number | null,
  judged: number | null,
): string | null {
  if (deposited === null || judged === null) return null
  const diff = Math.round((deposited + (online ?? 0)) * 100) - Math.round(judged * 100)
  return diff > 0 ? "over" : diff < 0 ? "short" : null
}

/** Builds a haystack in one place so it is lowercased in one place */
export function hay(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined && p !== "")
    .join(" ")
    .toLowerCase()
}

/** Every token must land somewhere in the haystack */
export function tokensHit(tokens: string[], haystack: string): boolean {
  return tokens.every((t) => haystack.includes(t))
}
