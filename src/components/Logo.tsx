import { useTheme } from "../lib/theme"
import light from "../assets/twz-logo-light.png"
import dark from "../assets/twz-logo-dark.png"

/*
 * The wordmark, in the cut for the current canvas: the tyre and frame are
 * near-black on the light logo and off-white on the dark one, and the wrong
 * one vanishes into its background.
 */
export function Logo({ className }: { className: string }) {
  const { theme } = useTheme()
  return (
    <img
      src={theme === "dark" ? dark : light}
      alt="Two Wheels Zone"
      className={className}
      draggable={false}
    />
  )
}
