/*
 * What a branch needs to act on right now — unlogged days, the deposit
 * backlog, a short deposit, the POS sync, and a sign-in from another device.
 *
 * It reads through the same API the pages do, so the status card can never
 * disagree with the figures beside it. Every query it needs is independent, so
 * they go out together rather than in sequence.
 */
import { hourLabel, peso, rowDate, timeAgo } from "./format"
import { addDays, dayKey, fromDayKey, startOfDay } from "./dateRange"
import { api } from "./api"

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

/* How far back a short deposit still counts as news worth surfacing */
const DISCREPANCY_WINDOW = 14
/* A sign-in from another device stays on the card this long */
const NEW_DEVICE_WINDOW_MS = 3 * 86_400_000

export async function branchNotices({
  storeId,
  managerId,
  now,
}: {
  storeId: string
  managerId: string
  now: Date
}): Promise<Notice[]> {
  const today = startOfDay(now)
  const todayKey = dayKey(today)
  const notices: Notice[] = []

  const [todayExpenses, pending, recent, hours, signIns, rules] = await Promise.all([
    api.expenses(storeId, { from: todayKey, to: todayKey }),
    api.pendingDeposits(storeId),
    api.dayAudits([storeId], {
      from: dayKey(addDays(today, -DISCREPANCY_WINDOW)),
      to: dayKey(addDays(today, -1)),
    }),
    api.hourlySales([storeId], todayKey),
    api.signIns(managerId),
    api.reconciliationRules(),
  ])

  /* The owner sets how many days may batch into one deposit */
  const batchWindowDays = rules.batchWindowDays

  // Today's spend — the one thing the branch owes the app every single day
  const todaySpend = todayExpenses.reduce((sum, i) => sum + i.amount, 0)
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
  const missed = pending.filter((a) => a.expenses === 0)
  if (missed.length > 0) {
    notices.push({
      id: "missed-expenses",
      tone: "alert",
      title:
        missed.length === 1
          ? `${rowDate(fromDayKey(missed[0].day))} has nothing logged`
          : `${missed.length} earlier days have nothing logged`,
      detail: "Not deposited yet, so these days can still be logged.",
      to: "/expenses",
      action: "Log expenses",
    })
  }

  // Everything audited but not yet covered by a bank deposit
  if (pending.length > 0) {
    const due = pending.reduce((sum, a) => sum + a.expected, 0)
    const since = rowDate(fromDayKey(pending[0].day))
    const late = pending.length > batchWindowDays
    notices.push({
      id: "deposit-backlog",
      tone: late ? "alert" : "info",
      title: late
        ? `${pending.length} days waiting for deposit`
        : `${pending.length} day${pending.length === 1 ? "" : "s"} ready to deposit`,
      detail: late
        ? `${peso.format(due)} due since ${since}, past the usual ${batchWindowDays}-day window.`
        : `${peso.format(due)} due since ${since}.`,
      to: "/deposits",
      action: "Record deposit",
    })
  }

  // The most recent deposit that did not match, if there is one
  const off = [...recent]
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .find((a) => a.status === "discrepancy" && a.deposited !== null)
  if (off && off.deposited !== null) {
    /* Centavos, then named by sign — "short by -₱180" reads as a bug. Online
       money counts with the cash, and the comparison is against what the
       deposit was judged on: its whole batch, not this one day's figure. */
    const judged =
      off.depositExpected ?? ((off.depositCovers?.length ?? 0) > 1 ? null : off.expected)
    const diffCents =
      judged === null
        ? null
        : Math.round(off.deposited * 100) +
          Math.round((off.online ?? 0) * 100) -
          Math.round(judged * 100)
    notices.push({
      id: "discrepancy",
      /* Over is information, not alarm — the drawer answered with more and
         the reason is on file. Only a shortfall keeps the alert tone. */
      tone: diffCents !== null && diffCents > 0 ? "info" : "alert",
      /* A batch deposit from before the judged sum was stored has no honest
         figure to name — the row still deserves its alert, just unnumbered */
      title:
        diffCents === null
          ? "A deposit did not match"
          : `Deposit ${diffCents < 0 ? "short" : "over"} by ${peso.format(Math.abs(diffCents) / 100)}`,
      detail: `${rowDate(fromDayKey(off.day))} · review the discrepancy in history.`,
      to: "/history",
      action: "View in history",
    })
  }

  // How far today's sales have come through from the POS
  const lastHour = hours[hours.length - 1]
  notices.push({
    id: "pos-sync",
    tone: "info",
    title: lastHour ? `Sales synced through ${hourLabel(lastHour.hour)}` : "No sales synced yet today",
    detail: lastHour
      ? "Loyverse POS is the source for this branch's sales."
      : "The branch opens at 8 AM. Sales start arriving from there.",
  })

  // A sign-in from a device other than this one, with where it came from
  const other = signIns.find((e) => !e.current)
  if (other && now.getTime() - new Date(other.at).getTime() <= NEW_DEVICE_WINDOW_MS) {
    notices.push({
      id: "new-device",
      tone: "info",
      title: `Signed in on ${other.device}`,
      detail: [other.ip, other.place, timeAgo(new Date(other.at), now)]
        .filter(Boolean)
        .join(" · "),
      to: "/account",
      action: "See every sign-in",
    })
  }

  return notices.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}
