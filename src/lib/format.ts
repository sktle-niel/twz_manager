/* Whole pesos stay clean (₱46,000); centavos show when they exist (₱180.50) —
   an amount echoed off a bank slip must never display rounded */
export const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function rowDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export function hourLabel(h: number): string {
  const hour = ((h % 24) + 24) % 24
  if (hour === 0) return "12 AM"
  if (hour === 12) return "12 PM"
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`
}

/* First and last initial, for the avatar fallback and the manager list */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

/*
 * The shop's clock. Every instant the API sends is UTC (ISO-8601 Zulu), and
 * every branch is in the Philippines — so a time is read on Manila's clock
 * whatever the device is set to. Without this a phone left on another
 * timezone labels last night's entry with the wrong hour, and nothing on
 * screen says so.
 */
const SHOP_TZ = "Asia/Manila"

export function clockLabel(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: SHOP_TZ,
  })
}

/*
 * The date an instant fell on, on the shop's clock. Separate from shortDate
 * because that one formats a calendar day the caller already built from
 * y/m/d parts — pinning a timezone onto it would shift the day instead of
 * fixing it. This one takes a real moment, where the timezone is the point.
 */
export function instantDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: SHOP_TZ,
  })
}

/*
 * Relative for the past week, dated after that. `now` is passed in rather than
 * read here so the caller can freeze it and the label stays stable per render.
 */
export function timeAgo(d: Date, now: Date): string {
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return `Yesterday, ${clockLabel(d)}`
  if (days < 7) return `${days} days ago, ${clockLabel(d)}`
  return `${instantDate(d)}, ${clockLabel(d)}`
}
