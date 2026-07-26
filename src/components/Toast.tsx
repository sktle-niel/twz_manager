import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

/*
 * Success toast: a check that draws itself, then the message.
 *
 * Portalled to the body — the pages that raise it sit inside elements whose
 * entry animation leaves a transform behind, which would otherwise trap
 * position:fixed inside them. Mount with a `key` that changes per message so
 * repeating the same text replays the animation.
 */
export function Toast({
  message,
  onDismiss,
  duration = 3200,
}: {
  message: string
  onDismiss: () => void
  duration?: number
}) {
  // Held in a ref so a parent re-render cannot restart the timer
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => dismiss.current(), duration)
    return () => window.clearTimeout(timer)
  }, [message, duration])

  if (!message) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div
        role="status"
        aria-live="polite"
        className="anim-toast pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 shadow-[0_8px_24px_rgba(21,22,19,0.14)]"
      >
        <span className="anim-check-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-sage-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M5 12.5 9.5 17 19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="anim-check-draw"
            />
          </svg>
        </span>
        <p className="text-[13.5px] font-medium text-ink">{message}</p>
      </div>
    </div>,
    document.body,
  )
}
