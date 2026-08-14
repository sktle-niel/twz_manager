import type { DayAudit, DayStatus } from "./api"
import { fromDayKey } from "./dateRange"

/** A status as the History surfaces paint it: "over" is a discrepancy where
    the extra went IN — good news wearing green instead of red */
export type PaintedStatus = DayStatus | "over"

/**
 * How far a covering deposit ran OVER what it was judged against, in pesos.
 * Zero when short, matched, no deposit, or on old batches whose judged sum
 * was never stored — those cannot honestly claim either direction.
 */
export function depositOverage(audit: DayAudit): number {
  if (audit.deposited === null) return 0
  const judged =
    audit.depositExpected ?? ((audit.depositCovers?.length ?? 0) > 1 ? null : audit.expected)
  if (judged === null) return 0
  const cents =
    Math.round(audit.deposited * 100) +
    Math.round((audit.online ?? 0) * 100) -
    Math.round(judged * 100)
  return cents > 0 ? cents / 100 : 0
}

export function paintedStatus(audit: DayAudit): PaintedStatus {
  return audit.status === "discrepancy" && depositOverage(audit) > 0 ? "over" : audit.status
}

/* One History line: a lone day, or every visible day one deposit covers */
export type HistoryEntry = {
  key: string
  /* Newest day first, matching the table's sort */
  audits: DayAudit[]
}

/*
 * Days covered by the same deposit collapse into one entry — five rows all
 * repeating the same ₱25,813 slip read as five deposits, and the reader had
 * to notice the shared reference to see otherwise. Uncovered days (pending,
 * open) stay their own rows. Input must be sorted newest-day first; a batch
 * holds the position of its newest visible day.
 */
/** The ReceiptDialog target for an entry, single day or batch alike */
export function receiptTargetFor(entry: HistoryEntry, branchName: string) {
  const head = entry.audits[0]
  return {
    date: fromDayKey(head.day),
    branchName,
    audit: head,
    ...(entry.audits.length > 1 ? { days: entry.audits } : {}),
  }
}

export function groupByDeposit(audits: DayAudit[]): HistoryEntry[] {
  const out: HistoryEntry[] = []
  const open = new Map<string, HistoryEntry>()

  for (const audit of audits) {
    const covers = audit.depositCovers
    if (audit.deposited === null || !covers || covers.length <= 1) {
      out.push({ key: `${audit.storeId}:${audit.day}`, audits: [audit] })
      continue
    }

    /* The batch's identity is the deposit itself: same branch, same
       reference, same covered span */
    const key = `${audit.storeId}|${audit.reference ?? ""}|${covers.join(",")}`
    const entry = open.get(key)
    if (entry) {
      entry.audits.push(audit)
    } else {
      const fresh = { key, audits: [audit] }
      open.set(key, fresh)
      out.push(fresh)
    }
  }

  return out
}
