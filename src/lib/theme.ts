/*
 * Light, dark, or whatever the device says.
 *
 * The choice is a per-device preference, kept in localStorage rather than on
 * the account: a manager on a phone in a dim shop and the same manager on the
 * shop's laptop want different things, and nothing about the ledger changes
 * with it. "System" is the default and follows the OS setting live, so a
 * phone that darkens at sunset takes the app with it.
 *
 * The palette itself lives in index.css as CSS variables keyed on
 * `<html data-theme="…">`; this module only decides which value to set and
 * tells React when it changed. public/theme-boot.js, loaded from index.html's
 * <head>, sets the same attribute before the first paint so a dark device
 * never sees a flash of the light canvas.
 */
import { useCallback, useSyncExternalStore } from "react"

export type ThemeChoice = "light" | "dark" | "system"
export type Theme = "light" | "dark"

const KEY = "twz-theme"

const listeners = new Set<() => void>()
const media = window.matchMedia("(prefers-color-scheme: dark)")

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  } catch {
    return "system"
  }
}

let choice: ThemeChoice = readChoice()

export function getThemeChoice(): ThemeChoice {
  return choice
}

/** What is actually on screen once "system" is resolved */
export function resolvedTheme(): Theme {
  if (choice === "system") return media.matches ? "dark" : "light"
  return choice
}

function apply(): void {
  const theme = resolvedTheme()
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme

  /* The browser chrome (address bar, status bar in the installed app) follows
     the canvas, read back from the palette rather than duplicated here */
  const canvas = getComputedStyle(root).getPropertyValue("--color-canvas").trim()
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta && canvas) meta.content = canvas

  for (const listener of listeners) listener()
}

export function setThemeChoice(next: ThemeChoice): void {
  choice = next
  try {
    if (next === "system") localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    /* Private mode or a full store: the choice still holds for this visit */
  }
  apply()
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/* The OS flipping while "system" is chosen is a change too */
media.addEventListener("change", () => {
  if (choice === "system") apply()
})

/* So is a choice made in another tab of the app: the storage event fires in
   every other tab, and without this they would sit on the old palette until
   reloaded. A cleared store (key null) reads back as "system". */
window.addEventListener("storage", (event) => {
  if (event.key === KEY || event.key === null) {
    choice = readChoice()
    apply()
  }
})

/* Applied at import, which main.tsx does before anything renders; the
   pre-paint script public/theme-boot.js has usually set the same value already */
apply()

export function useTheme(): {
  choice: ThemeChoice
  theme: Theme
  setChoice: (next: ThemeChoice) => void
} {
  const current = useSyncExternalStore(subscribeTheme, getThemeChoice)
  const theme = useSyncExternalStore(subscribeTheme, resolvedTheme)
  const setChoice = useCallback((next: ThemeChoice) => setThemeChoice(next), [])
  return { choice: current, theme, setChoice }
}

/*
 * The palette's colours as strings, for the one place that cannot use a
 * class: recharts paints SVG from props. Re-read whenever the theme changes.
 */
export function paletteColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}
