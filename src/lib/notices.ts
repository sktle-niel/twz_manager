/*
 * What a branch needs to act on right now, derived from the same mock the
 * pages already read — unlogged days, the deposit backlog, a short deposit,
 * the POS sync, and a sign-in from another device. One source, so the
 * dashboard status card and anything added later (a bell, a push
 * notification) can never disagree about the branch's state.
 */
import { hourLabel, peso, rowDate, timeAgo } from "./format"
import {
  dayAuditFor,
  expectedDepositFor,
  expensesFor,
  pendingDepositDays,
  signInLogFor,
  visibleHourlySales,
} from "./mock"
import { addDays, startOfDay } from "./dateRange"

export type NoticeTone = "alert" | "info" | "ok"

export type Notice = {
  id: string
  tone: NoticeTone
  title: string
  detail: string
  /* Where the fix lives, when there is one to make */
  to?: string
  action?: string
}

/* Alerts first, then what is merely worth knowing, then what is already fine */
const TONE_ORDER: Record<NoticeTone, number> = { alert: 0, info: 1, ok: 2 }

/* Branches deposit daily or batch up to every ~3 days; past that is a backlog */
const DEPOSIT_BATCH_DAYS = 3
/* How far back a short deposit still counts as news worth surfacing */
const DISCREPANCY_WINDOW = 14
/* A sign-in from another device stays on the card this long */
const NEW_DEVICE_WINDOW_MS = 3 * 86_400_000

export function branchNotices({
  storeId,
  managerId,
  now,
}: {
  storeId: string
  managerId: string
  now: Date
}): Notice[] {
  const today = startOfDay(now)
  const notices: Notice[] = []

  // Today's spend — the one thing the branch owes the app every single day
  const todaySpend = expensesFor(storeId, today)
  notices.push(
    todaySpend === 0
      ? {
          id: "today-expenses",
          tone: "alert",
          title: "No expenses logged today",
          detail:
            "Meals, merienda, and anything else spent are deducted from tonight's expected deposit.",
          to: "/expenses",
          action: "Log expenses",
        }
      : {
          id: "today-expenses",
          tone: "ok",
          title: "Today's expenses are logged",
          detail: `${peso.format(todaySpend)} so far, already deducted from the expected deposit.`,
        },
  )

  // Earlier days that are still open and were never logged at all
  const pending = pendingDepositDays(storeId, today)
  const missed = pending.filter((d) => expensesFor(storeId, d) === 0)
  if (missed.length > 0) {
    notices.push({
      id: "missed-expenses",
      tone: "alert",
      title:
        missed.length === 1
          ? `${rowDate(missed[0])} has nothing logged`
          : `${missed.length} earlier days have nothing logged`,
      detail: "Not deposited yet, so these days can still be logged.",
      to: "/expenses",
      action: "Log expenses",
    })
  }

  // Everything audited but not yet covered by a bank deposit
  if (pending.length > 0) {
    const due = pending.reduce((sum, d) => sum + expectedDepositFor(storeId, d), 0)
    const late = pending.length > DEPOSIT_BATCH_DAYS
    notices.push({
      id: "deposit-backlog",
      tone: late ? "alert" : "info",
      title: late
        ? `${pending.length} days waiting for deposit`
        : `${pending.length} day${pending.length === 1 ? "" : "s"} ready to deposit`,
      detail: late
        ? `${peso.format(due)} due since ${rowDate(pending[0])} — past the usual 3-day window.`
        : `${peso.format(due)} due since ${rowDate(pending[0])}.`,
      to: "/deposits",
      action: "Record deposit",
    })
  }

  // The most recent deposit that came up short, if there is one
  for (let i = 1; i <= DISCREPANCY_WINDOW; i++) {
    const d = addDays(today, -i)
    const audit = dayAuditFor(storeId, d)
    if (audit.status !== "discrepancy" || audit.deposited === null) continue
    notices.push({
      id: "discrepancy",
      tone: "alert",
      title: `Deposit short by ${peso.format(audit.expected - audit.deposited)}`,
      detail: `${rowDate(d)} · reference ${audit.reference}.`,
      to: "/history",
      action: "View in history",
    })
    break
  }

  // How far today's sales have come through from the POS
  const hours = visibleHourlySales(storeId, today)
  const lastHour = hours[hours.length - 1]
  notices.push({
    id: "pos-sync",
    tone: "info",
    title: lastHour ? `Sales synced through ${hourLabel(lastHour.hour)}` : "No sales synced yet today",
    detail: lastHour
      ? "Loyverse POS is the source for this branch's sales."
      : "The branch opens at 8 AM — sales start arriving from there.",
  })

  // A sign-in from a device other than this one, with where it came from
  const other = signInLogFor(managerId, now).find((e) => !e.current)
  if (other && now.getTime() - other.at.getTime() <= NEW_DEVICE_WINDOW_MS) {
    notices.push({
      id: "new-device",
      tone: "info",
      title: `Signed in on ${other.device}`,
      detail: `${other.ip} · ${other.place} · ${timeAgo(other.at, now)}`,
      to: "/account",
      action: "See every sign-in",
    })
  }

  return notices.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}
