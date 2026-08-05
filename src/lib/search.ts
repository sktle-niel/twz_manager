/*
 * The index behind the global search. Everything the app knows about — audited
 * days, individual expenses, deposits, and (for the owner) accounts and
 * branches — is flattened into records that carry one lowercase `haystack`
 * string each.
 *
 * Matching is deliberately one mechanism rather than a mode per field: every
 * token in the query must appear somewhere in the haystack. Because each
 * record's haystack already spells its date several ways, its amounts as bare
 * digits, and its own kind, a single rule covers "july 3 2026", "meals
 * arevalo", "712063", and "discrepancy july" without the caller choosing.
 *
 * The one thing substring matching cannot do is understand "7/3/2026", so a
 * date hint is parsed alongside it and matched against the record's own date.
 */
import { clockLabel, peso, rowDate, shortDate } from "./format"
import { api } from "./api"
import type { DayAudit, DayStatus, ExpenseItem, Manager, Store } from "./api"
import { addDays, dayKey, fromDayKey, startOfDay } from "./dateRange"

/* Matches the History page's longest range, so the two agree on how far back
   "everything" reaches. The whole corpus is built in one pass when the overlay
   opens, so this is also what keeps that pass cheap. */
export const WINDOW_DAYS = 90

/* Below this a query matches most of the corpus and the list is noise */
export const SEARCH_MIN = 2

/* Per group; the rest are counted rather than listed */
const PER_GROUP = 6

export type SearchKind = "day" | "expense" | "deposit" | "manager" | "branch"

export const KIND_LABEL: Record<SearchKind, string> = {
  day: "Audited days",
  expense: "Expenses",
  deposit: "Deposits",
  manager: "Managers",
  branch: "Branches",
}

const KIND_ORDER: SearchKind[] = ["day", "expense", "deposit", "manager", "branch"]

const STATUS_LABEL: Record<DayStatus, string> = {
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
  /* The record's own day, for date matching and recency order; 0 when it has
     no date of its own, like an account */
  at: number
  haystack: string
}

export type SearchRoutes = Record<SearchKind, { to: string; label: string }>

export type SearchScope = {
  storeIds: string[]
  routes: SearchRoutes
  /* Accounts and branches are the owner's to see; a manager gets neither */
  includeAccounts: boolean
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

/* Every way a reader might write this day, so a word query like "july" reaches
   it without the caller choosing a date mode */
function dateWords(d: Date): string {
  return [
    rowDate(d),
    MONTHS[d.getMonth()],
    d.getDate(),
    d.getFullYear(),
    dayKey(d),
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`,
  ].join(" ")
}

/*
 * Builds a haystack in one place so it is lowercased in one place. Assembling
 * these inline invited a real bug: `a + b.toLowerCase()` binds the call to `b`
 * alone, which left the branch name, the category, and the status label in
 * their original case, and "meals", "wifi bill", and "discrepancy" all matched
 * nothing at all.
 */
function hay(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined && p !== "")
    .join(" ")
    .toLowerCase()
}

export async function buildCorpus(scope: SearchScope, today: Date): Promise<SearchRecord[]> {
  const base = startOfDay(today)
  const from = dayKey(addDays(base, -WINDOW_DAYS))
  const to = dayKey(base)

  /* Every query the index needs, in parallel — one call per resource across the
     whole window, not one per day */
  const [allStores, audits, managers, expensesPerStore] = await Promise.all([
    api.stores(),
    api.dayAudits(scope.storeIds, { from, to }),
    scope.includeAccounts ? api.managers() : Promise.resolve([] as Manager[]),
    Promise.all(scope.storeIds.map((id) => api.expenses(id, { from, to }))),
  ])

  const stores: Store[] = allStores.filter((s) => scope.storeIds.includes(s.id))
  const records: SearchRecord[] = []
  const { routes } = scope

  const auditsByStore = new Map<string, DayAudit[]>()
  for (const a of audits) auditsByStore.set(a.storeId, [...(auditsByStore.get(a.storeId) ?? []), a])
  const expensesByStore = new Map<string, ExpenseItem[]>(
    scope.storeIds.map((id, i) => [id, expensesPerStore[i] ?? []]),
  )

  for (const store of stores) {
    /* Keyed by reference, because one bank deposit can cover several audited
       days and should surface once rather than once per day */
    const deposits = new Map<
      string,
      { amount: number; expected: number; days: Date[]; short: boolean }
    >()

    for (const audit of auditsByStore.get(store.id) ?? []) {
      const d = fromDayKey(audit.day)
      const key = audit.day
      const words = dateWords(d)
      const status = STATUS_LABEL[audit.status]
      const shortfall =
        audit.deposited !== null && audit.deposited < audit.expected
          ? audit.expected - audit.deposited
          : 0

      records.push({
        id: `day-${store.id}-${key}`,
        kind: "day",
        title: rowDate(d),
        subtitle: `${store.name} · ${status}`,
        meta: peso.format(audit.expected),
        details: [
          { label: "Branch", value: store.name },
          {
            label: "Status",
            value: status,
            tone:
              audit.status === "discrepancy"
                ? "bad"
                : audit.status === "matched"
                  ? "good"
                  : undefined,
          },
          { label: "Gross sales", value: peso.format(audit.gross) },
          { label: "Expenses", value: peso.format(audit.expenses) },
          { label: "Expected deposit", value: peso.format(audit.expected) },
          {
            label: "Deposited",
            value: audit.deposited === null ? "Not yet" : peso.format(audit.deposited),
          },
          ...(shortfall > 0
            ? [{ label: "Short by", value: peso.format(shortfall), tone: "bad" as const }]
            : []),
          ...(audit.reference ? [{ label: "Reference", value: audit.reference }] : []),
        ],
        to: routes.day.to,
        toLabel: routes.day.label,
        at: d.getTime(),
        haystack: hay(
          "audited day audit",
          store.name,
          words,
          status,
          audit.gross,
          audit.expenses,
          audit.expected,
          audit.deposited,
          audit.reference,
        ),
      })

      for (const item of (expensesByStore.get(store.id) ?? []).filter((i) => i.day === key)) {
        records.push({
          id: `expense-${item.id}`,
          kind: "expense",
          title: item.note,
          subtitle: `${item.category} · ${store.name} · ${rowDate(d)}`,
          meta: peso.format(item.amount),
          details: [
            { label: "Category", value: item.category },
            { label: "Branch", value: store.name },
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
          at: d.getTime(),
          haystack: hay(
            "expense",
            item.note,
            item.category,
            store.name,
            words,
            item.amount,
            clockLabel(new Date(item.at)),
            item.receiptUrls.length === 0 ? "no receipt" : "receipt",
          ),
        })
      }

      if (audit.reference && audit.deposited !== null) {
        const held = deposits.get(audit.reference)
        if (held) {
          held.amount += audit.deposited
          held.expected += audit.expected
          held.days.push(d)
          held.short = held.short || shortfall > 0
        } else {
          deposits.set(audit.reference, {
            amount: audit.deposited,
            expected: audit.expected,
            days: [d],
            short: shortfall > 0,
          })
        }
      }
    }

    for (const [reference, dep] of deposits) {
      const days = [...dep.days].sort((a, b) => a.getTime() - b.getTime())
      const covers =
        days.length === 1
          ? rowDate(days[0])
          : `${shortDate(days[0])} - ${shortDate(days[days.length - 1])}`
      const status = dep.short ? "Discrepancy" : "Matched"

      records.push({
        id: `deposit-${store.id}-${reference}`,
        kind: "deposit",
        title: `Deposit ${reference}`,
        subtitle: `${store.name} · covers ${covers}`,
        meta: peso.format(dep.amount),
        details: [
          { label: "Branch", value: store.name },
          { label: "Reference", value: reference },
          {
            label: "Status",
            value: status,
            tone: dep.short ? "bad" : "good",
          },
          { label: "Deposited", value: peso.format(dep.amount) },
          { label: "Expected", value: peso.format(dep.expected) },
          ...(dep.short
            ? [
                {
                  label: "Short by",
                  value: peso.format(dep.expected - dep.amount),
                  tone: "bad" as const,
                },
              ]
            : []),
          {
            label: days.length === 1 ? "Covers" : `Covers ${days.length} days`,
            value: days.map((d) => shortDate(d)).join(", "),
          },
        ],
        to: routes.deposit.to,
        toLabel: routes.deposit.label,
        at: days[days.length - 1].getTime(),
        haystack: hay(
          "deposit slip",
          reference,
          store.name,
          status,
          dep.amount,
          dep.expected,
          days.map((d) => dateWords(d)).join(" "),
        ),
      })
    }
  }

  if (scope.includeAccounts) {
    for (const store of stores) {
      const held = managers.find((m) => m.storeId === store.id)
      records.push({
        id: `branch-${store.id}`,
        kind: "branch",
        title: store.name,
        subtitle: held ? `Managed by ${held.name}` : "No manager assigned",
        details: [
          { label: "Branch", value: store.name },
          { label: "Manager", value: held?.name ?? "None assigned" },
          { label: "POS", value: "Loyverse-linked", tone: "good" },
        ],
        to: routes.branch.to,
        toLabel: routes.branch.label,
        at: 0,
        haystack: hay("branch store", store.name, held?.name ?? "unassigned no manager"),
      })
    }

    for (const m of managers) {
      const store = allStores.find((s) => s.id === m.storeId)
      records.push({
        id: `manager-${m.id}`,
        kind: "manager",
        title: m.name,
        subtitle: `${m.username} · ${store?.name ?? "Unassigned"}`,
        details: [
          { label: "Name", value: m.name },
          { label: "Username", value: m.username },
          { label: "Branch", value: store?.name ?? "Unassigned" },
          {
            label: "Account",
            value: m.active ? "Active" : "Disabled",
            tone: m.active ? "good" : "bad",
          },
        ],
        to: routes.manager.to,
        toLabel: routes.manager.label,
        at: 0,
        haystack: hay(
          "manager account",
          m.name,
          m.username,
          store?.name,
          m.active ? "active" : "disabled",
        ),
      })
    }
  }

  return records
}

type DateHint = { year?: number; month?: number; day?: number }

/*
 * Splits a query into a date and whatever else was typed.
 *
 * A recognised date has to narrow the results rather than merely add to them.
 * Leaving "july 3 2026" to substring matching returned every record in July:
 * "july" and "2026" sit in each of their date words, and a bare "3" turns up
 * inside almost any peso figure. So the date becomes a filter on the record's
 * own date, and only the leftover words stay substring matches — which is also
 * what makes "meals july 3" mean meals *on* that day.
 *
 * Bare numbers are only read as a day or a year when a month was named. On
 * their own they stay ordinary tokens, so "480" and "712063" still find an
 * amount and a deposit reference.
 */
function parseQuery(raw: string): { hint: DateHint | null; tokens: string[] } {
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

function matchesHint(record: SearchRecord, hint: DateHint): boolean {
  // An account has no date of its own, so a dated query is not asking for it
  if (!record.at) return false
  const d = new Date(record.at)
  if (hint.year !== undefined && d.getFullYear() !== hint.year) return false
  if (hint.month !== undefined && d.getMonth() !== hint.month) return false
  if (hint.day !== undefined && d.getDate() !== hint.day) return false
  return true
}

export function runSearch(corpus: SearchRecord[], query: string): SearchRecord[] {
  if (query.trim().length < SEARCH_MIN) return []

  const { hint, tokens } = parseQuery(query)
  if (!hint && tokens.length === 0) return []

  return corpus
    .filter((r) => {
      if (hint && !matchesHint(r, hint)) return false
      return tokens.every((t) => r.haystack.includes(t))
    })
    .sort((a, b) => b.at - a.at)
}

export type SearchGroup = {
  kind: SearchKind
  label: string
  items: SearchRecord[]
  /* Everything that matched, so a truncated group can say how much it is hiding */
  total: number
}

export function groupResults(results: SearchRecord[]): SearchGroup[] {
  return KIND_ORDER.map((kind) => {
    const all = results.filter((r) => r.kind === kind)
    return { kind, label: KIND_LABEL[kind], items: all.slice(0, PER_GROUP), total: all.length }
  }).filter((g) => g.total > 0)
}
