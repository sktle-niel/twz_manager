import { CircleHalfIcon, DeviceMobileIcon, MoonIcon, SunIcon } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { useTheme } from "../lib/theme"
import type { ThemeChoice } from "../lib/theme"

const CHOICES: { value: ThemeChoice; label: string; hint: string; icon: Icon }[] = [
  { value: "light", label: "Light", hint: "Bright screen, day and night", icon: SunIcon },
  { value: "dark", label: "Dark", hint: "Easier on the eyes at night", icon: MoonIcon },
  { value: "system", label: "Auto", hint: "Follows this device's own setting", icon: DeviceMobileIcon },
]

/*
 * Light, dark, or the device's own choice — a per-device preference on the
 * Account page, beside the other things that are about this phone rather
 * than the account (install, reminders). The crew stays visible in both.
 */
export function AppearanceCard() {
  const { choice, theme, setChoice } = useTheme()

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" data-rise>
      <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
        <CircleHalfIcon size={16} weight="bold" aria-hidden="true" />
        Appearance
      </h2>
      <p className="mt-1 text-[13px] leading-[1.55] text-mute">
        Light or dark. This is a per-device setting, not part of your account &mdash; your other
        phone or laptop keeps its own.
      </p>

      <div role="group" aria-label="Appearance" className="mt-4 grid gap-2 sm:grid-cols-3">
        {CHOICES.map(({ value, label, hint, icon: ChoiceIcon }) => {
          const selected = choice === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setChoice(value)}
              className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-left transition-colors duration-200 ease-quiet ${
                selected
                  ? "border-brand-deep bg-sage text-sage-ink"
                  : "border-line-strong text-ink hover:bg-ink/[0.03]"
              }`}
            >
              <ChoiceIcon size={18} weight={selected ? "fill" : "regular"} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{label}</span>
                {/* Solid sage-ink when selected: at 80% it fell under 4.5:1 on sage in light */}
                <span className={`block text-[12px] leading-[1.5] ${selected ? "text-sage-ink" : "text-mute"}`}>
                  {hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {choice === "system" && (
        <p className="mt-2.5 text-[12.5px] text-mute">
          Right now the device is set to {theme}.
        </p>
      )}
    </section>
  )
}
