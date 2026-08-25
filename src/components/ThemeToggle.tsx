import { MoonIcon, SunIcon } from "@phosphor-icons/react"
import { useTheme } from "../lib/theme"

/*
 * One tap between light and dark, in the shell where it is always within
 * reach. Tapping sets an explicit choice — a manager who flips it at night
 * wants it to stay, not to snap back at the OS's say-so; "follow the device"
 * is offered on the Account page's Appearance card.
 *
 * Two shapes: the bare icon for the mobile top bar, and a labelled row that
 * sits with the sidebar's other rows on desktop.
 */
export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const { theme, setChoice } = useTheme()
  const toDark = theme === "light"
  const label = toDark ? "Dark mode" : "Light mode"
  const Glyph = toDark ? MoonIcon : SunIcon

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={() => setChoice(toDark ? "dark" : "light")}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors duration-200 ease-quiet hover:bg-ink/[0.04] hover:text-ink"
      >
        <Glyph size={18} aria-hidden="true" />
        <span>{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setChoice(toDark ? "dark" : "light")}
      aria-label={toDark ? "Switch to dark mode" : "Switch to light mode"}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-mute transition-colors duration-200 ease-quiet hover:bg-ink/[0.04] hover:text-ink"
    >
      <Glyph size={20} aria-hidden="true" />
    </button>
  )
}
