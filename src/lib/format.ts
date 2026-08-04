export const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
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
  if (h === 12) return "12 PM"
  return h > 12 ? `${h - 12} PM` : `${h} AM`
}

/* First and last initial, for the avatar fallback and the manager list */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

export function clockLabel(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
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
  return `${shortDate(d)}, ${clockLabel(d)}`
}
