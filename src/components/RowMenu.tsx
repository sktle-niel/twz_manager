import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DotsThreeVerticalIcon } from "@phosphor-icons/react"

const MENU_WIDTH = 190
const GUTTER = 8

export type RowMenuItem = {
  label: string
  onSelect: () => void
  disabled?: boolean
  /* Destructive actions read in claret so they are not fired by muscle memory */
  tone?: "danger"
}

/*
 * Overflow menu for a table row, holding the actions that do not fit as their
 * own column. Rendered through a portal and positioned from the trigger's
 * measured rect: the rows sit inside an element whose entry animation leaves a
 * transform behind, which would otherwise trap position:fixed inside it.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const open = anchor !== null

  useEffect(() => {
    if (!open) return
    const close = () => setAnchor(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("resize", close)
    // Capture phase: the menu is fixed, so any scroll would detach it
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [open])

  function toggle() {
    if (open) {
      setAnchor(null)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setAnchor({
      top: rect.bottom + 4,
      left: Math.max(
        GUTTER,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - GUTTER),
      ),
    })
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.06] hover:text-ink"
      >
        <DotsThreeVerticalIcon size={17} weight="bold" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setAnchor(null)}
              className="fixed inset-0 z-50 cursor-default"
            />
            <div
              role="menu"
              aria-label={label}
              style={{ top: anchor.top, left: anchor.left, width: MENU_WIDTH }}
              className="anim-fade fixed z-50 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(21,22,19,0.12)]"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setAnchor(null)
                    item.onSelect()
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-[13.5px] transition-colors duration-200 ease-quiet disabled:pointer-events-none disabled:text-mute ${
                    item.tone === "danger"
                      ? "text-claret hover:bg-claret/[0.07]"
                      : "text-ink-soft hover:bg-black/[0.04] hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
