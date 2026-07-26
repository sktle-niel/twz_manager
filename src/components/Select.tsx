import { useEffect, useId, useRef, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { createPortal } from "react-dom"
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react"

export type SelectOption = { value: string; label: string; hint?: string }

type Anchor = {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
}

const GUTTER = 8

const filterTrigger =
  "inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface py-2 pl-3 pr-2.5 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-quiet hover:border-mute focus-visible:border-brand-deep focus-visible:shadow-[0_0_0_2px_rgba(30,125,27,0.8)] lg:text-[14px]"
const fieldTrigger =
  "flex w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-quiet hover:border-mute focus-visible:border-brand-deep focus-visible:shadow-[0_0_0_2px_rgba(30,125,27,0.8)] lg:text-[15px]"

/*
 * Custom listbox that replaces the native <select>. Styled options, keyboard
 * navigation, and a check on the current choice — the popover is portalled to
 * the body and positioned from the trigger's measured rect, since the pages
 * that use it sit inside elements whose entry animation leaves a transform
 * behind that would otherwise trap position:fixed.
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  variant = "field",
  icon,
  id,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  ariaLabel: string
  variant?: "filter" | "field"
  icon?: ReactNode
  id?: string
  disabled?: boolean
  /* Extra trigger classes — e.g. a fixed width so a row of selects lines up */
  className?: string
}) {
  const baseId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [active, setActive] = useState(0)
  const open = anchor !== null

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  function openMenu() {
    if (disabled) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom - GUTTER
    const spaceAbove = rect.top - GUTTER
    const below = spaceBelow >= 200 || spaceBelow >= spaceAbove
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    setAnchor(
      below
        ? { top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight: Math.min(288, spaceBelow - 4) }
        : {
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            width: rect.width,
            maxHeight: Math.min(288, spaceAbove - 4),
          },
    )
  }

  // Move keyboard focus into the listbox when it opens
  useEffect(() => {
    if (open) menuRef.current?.focus()
  }, [open])

  // Keep the highlighted option in view as the user arrows through
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector(`#${baseId}-opt-${active}`)?.scrollIntoView({ block: "nearest" })
  }, [open, active, baseId])

  // A scroll or resize would detach the fixed menu, so close it
  useEffect(() => {
    if (!open) return
    const close = () => setAnchor(null)
    window.addEventListener("resize", close)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [open])

  function choose(option: SelectOption) {
    onChange(option.value)
    setAnchor(null)
    triggerRef.current?.focus()
  }

  function onMenuKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === "Home") {
      e.preventDefault()
      setActive(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActive(options.length - 1)
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (options[active]) choose(options[active])
    } else if (e.key === "Escape" || e.key === "Tab") {
      setAnchor(null)
      if (e.key === "Escape") triggerRef.current?.focus()
    }
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      openMenu()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setAnchor(null) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`${variant === "filter" ? filterTrigger : fieldTrigger} ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${className ?? ""}`}
      >
        {icon && <span className="shrink-0 text-mute">{icon}</span>}
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? ""}</span>
        <CaretDownIcon
          size={13}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 text-mute transition-transform duration-200 ease-quiet ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setAnchor(null)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              ref={menuRef}
              role="listbox"
              aria-label={ariaLabel}
              aria-activedescendant={`${baseId}-opt-${active}`}
              tabIndex={-1}
              onKeyDown={onMenuKeyDown}
              style={{
                left: anchor.left,
                // At least as wide as the trigger, but grows to fit option text
                // (e.g. a "held by …" hint) without overflowing the viewport
                minWidth: anchor.width,
                maxWidth: Math.max(anchor.width, window.innerWidth - anchor.left - GUTTER),
                maxHeight: anchor.maxHeight,
                ...(anchor.top != null ? { top: anchor.top } : { bottom: anchor.bottom }),
              }}
              className="anim-pop fixed z-50 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-[0_10px_30px_rgba(21,22,19,0.14)] focus:outline-none"
            >
              {options.map((o, i) => {
                const isSelected = o.value === value
                const isActive = i === active
                return (
                  <div
                    key={o.value}
                    id={`${baseId}-opt-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(o)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[14px] transition-colors duration-150 ease-quiet ${
                      isSelected
                        ? "bg-sage font-medium text-sage-ink"
                        : isActive
                          ? "bg-black/[0.04] text-ink"
                          : "text-ink-soft"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && (
                        <span className="block truncate text-[12px] text-mute">{o.hint}</span>
                      )}
                    </span>
                    {isSelected && (
                      <CheckIcon size={15} weight="bold" aria-hidden="true" className="shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
