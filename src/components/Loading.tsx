import { CircleNotchIcon } from "@phosphor-icons/react"

/*
 * The one loading treatment, everywhere: a quiet spinner beside the word.
 * Pages used to each write their own "Loading…" line, which meant the wait
 * looked slightly different on every screen.
 */
export function Loading({
  label = "Loading…",
  className = "",
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      aria-busy="true"
      className={`inline-flex items-center justify-center gap-2 text-mute ${className}`}
    >
      <CircleNotchIcon size={16} aria-hidden="true" className="shrink-0 animate-spin" />
      <span>{label}</span>
    </span>
  )
}
