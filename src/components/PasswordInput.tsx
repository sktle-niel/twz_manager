import { useState } from "react"
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react"
import { inputBad, inputBase, inputOk } from "./ui"

/*
 * A password field with its eye: the toggle shows what was typed, and an
 * optional dot row underneath counts the characters while they are still
 * masked — one dot per character, so "did that keystroke land" and "how far
 * to the minimum" can both be answered without unmasking anything.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  dots,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  invalid?: boolean
  /* Render the character dots under the field; `ok` colours them settled
     and `label` says what the count means ("6 of 8 minimum", "matches") */
  dots?: { ok: boolean; label: string }
}) {
  const [show, setShow] = useState(false)

  return (
    <>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className={`${inputBase} pr-11 ${invalid ? inputBad : inputOk}`}
        />
        {/* h-11/w-11 fills the input's reserved pr-11 strip: 44px tap target, same visual */}
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-0 top-1/2 mt-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-mute transition-colors duration-200 ease-quiet hover:text-ink"
        >
          {show ? (
            <EyeSlashIcon size={17} weight="bold" aria-hidden="true" />
          ) : (
            <EyeIcon size={17} weight="bold" aria-hidden="true" />
          )}
        </button>
      </div>
      {dots && value.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span aria-hidden="true" className="flex max-w-full flex-wrap items-center gap-[3px]">
            {Array.from({ length: value.length }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${dots.ok ? "bg-sage-ink" : "bg-claret/60"}`}
              />
            ))}
          </span>
          <span className={`text-[12px] tabular-nums ${dots.ok ? "text-sage-ink" : "text-mute"}`}>
            {dots.label}
          </span>
        </div>
      )}
    </>
  )
}
