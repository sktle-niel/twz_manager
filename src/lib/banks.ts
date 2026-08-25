/*
 * The banks a branch can deposit to, and what each one's paper is called.
 *
 * Most branches bank at BDO Network Bank and file its cash transaction slip;
 * one deposits to BPI, whose teller hands back a deposit/payment receipt
 * instead. The owner sets the bank per branch in Settings, and everything that
 * talks about "the slip" — the photo check, the camera guide, the field hints —
 * reads the bank off the branch rather than assuming BDO.
 */
import type { Bank, Store } from "./api/types"

export type BankInfo = {
  id: Bank
  /** The full name, for settings and the owner's eyes */
  name: string
  /** The short name managers say — "BDO", "BPI" */
  short: string
  /** What the bank calls the paper it hands back */
  paper: string
  /** The paper's shape, for the camera's frame guide: BDO's slip is a wide
      form, BPI's receipt a tall strip */
  portrait: boolean
}

export const BANKS: Record<Bank, BankInfo> = {
  bdo: {
    id: "bdo",
    name: "BDO Network Bank",
    short: "BDO",
    paper: "transaction slip",
    portrait: false,
  },
  bpi: {
    id: "bpi",
    name: "BPI",
    short: "BPI",
    paper: "deposit receipt",
    portrait: true,
  },
}

/** In the order the owner picks from */
export const BANK_IDS: Bank[] = ["bdo", "bpi"]

/** What a branch banked at before the bank was stored per branch */
export const DEFAULT_BANK: Bank = "bdo"

export function isBank(value: unknown): value is Bank {
  return value === "bdo" || value === "bpi"
}

/** The branch's bank, reading a missing value as the default */
export function storeBank(store: Pick<Store, "bank">): Bank {
  return store.bank ?? DEFAULT_BANK
}
