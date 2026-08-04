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

export const CATEGORIES: ExpenseCategory[] = [
  "Meals",
  "Merienda",
  "Water bill",
  "Electric bill",
  "Wifi bill",
  "Other",
]

export const CATEGORY_ICON: Record<ExpenseCategory, Icon> = {
  Meals: BowlFoodIcon,
  Merienda: CoffeeIcon,
  "Water bill": DropIcon,
  "Electric bill": LightningIcon,
  "Wifi bill": WifiHighIcon,
  Other: PackageIcon,
}

export const NOTE_PLACEHOLDER: Record<ExpenseCategory, string> = {
  Meals: "e.g. Staff lunch",
  Merienda: "e.g. Afternoon merienda",
  "Water bill": "e.g. June billing period",
  "Electric bill": "e.g. June billing period, meter reading",
  "Wifi bill": "e.g. June billing period, account number",
  Other: "e.g. Tricycle fare, parts pickup",
}

export const DEFAULT_NOTE: Record<ExpenseCategory, string> = {
  Meals: "Staff meal",
  Merienda: "Afternoon merienda",
  "Water bill": "Water bill",
  "Electric bill": "Electric bill",
  "Wifi bill": "Wifi bill",
  Other: "Other expense",
}

/* Company-covered staff spend: logged without a receipt, unlike every other category */
export const RECEIPT_OPTIONAL: ExpenseCategory[] = ["Meals", "Merienda"]
