import {
  BowlFoodIcon,
  CoffeeIcon,
  DropIcon,
  LightningIcon,
  PackageIcon,
  WifiHighIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import type { ExpenseCategory } from "./api"

/*
 * Category names are server data — the owner renames, adds, and removes them
 * in Settings, so nothing here is a list of what exists. What the frontend
 * keeps is cosmetic: a recognisable icon and a helpful placeholder for the
 * names it knows, and a sane fallback for any name it has never seen. A brand
 * new category must render, not crash.
 */

const KNOWN_ICON: Record<string, Icon> = {
  meals: BowlFoodIcon,
  merienda: CoffeeIcon,
  "water bill": DropIcon,
  "electric bill": LightningIcon,
  "wifi bill": WifiHighIcon,
}

export function categoryIcon(category: ExpenseCategory): Icon {
  return KNOWN_ICON[category.trim().toLowerCase()] ?? PackageIcon
}

const KNOWN_PLACEHOLDER: Record<string, string> = {
  meals: "e.g. Staff lunch",
  merienda: "e.g. Afternoon merienda",
  "water bill": "e.g. June billing period",
  "electric bill": "e.g. June billing period, meter reading",
  "wifi bill": "e.g. June billing period, account number",
}

export function notePlaceholder(category: ExpenseCategory): string {
  return KNOWN_PLACEHOLDER[category.trim().toLowerCase()] ?? "e.g. What this was for"
}

/** Stands in when the note is left blank, so a row never reads as empty */
export function defaultNote(category: ExpenseCategory): string {
  return category.trim() || "Expense"
}
