import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { DUR, EASE, prefersReducedMotion } from "../lib/motion"

/*
 * Success toast: a check that draws itself, then the message.
 *
 * Portalled to the body — the pages that raise it sit inside elements that hold
 * a transform while their entry animation runs, which would otherwise trap
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

  const cardRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const tickRef = useRef<SVGPathElement>(null)

  /*
   * The card drops in, its ring pops on the same beat, and the tick draws
   * itself just behind them. One timeline, so the three keep their offsets
   * whatever the durations become — as three separate animations they had to
   * agree on a delay by hand.
   */
  useGSAP(
    () => {
      const card = cardRef.current
      const ring = ringRef.current
      const tick = tickRef.current
      if (!card || !ring || !tick || prefersReducedMotion()) return
      gsap
        .timeline()
        .from(card, { opacity: 0, y: -12, duration: DUR.toast, ease: EASE }, 0)
        .from(ring, { opacity: 0, scale: 0.72, duration: DUR.ring, ease: EASE }, 0)
        .fromTo(
          tick,
          { strokeDashoffset: 22 },
          { strokeDashoffset: 0, duration: DUR.tick, ease: EASE },
          0.11,
        )
    },
    { dependencies: [message], revertOnUpdate: true },
  )

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => dismiss.current(), duration)
    return () => window.clearTimeout(timer)
  }, [message, duration])

  if (!message) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div
        ref={cardRef}
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 shadow-[0_8px_24px_rgba(21,22,19,0.14)]"
      >
        <span
          ref={ringRef}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage text-sage-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            {/* Resting state is the finished tick, so a skipped animation
                leaves a drawn check rather than an empty ring */}
            <path
              ref={tickRef}
              d="M5 12.5 9.5 17 19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={22}
            />
          </svg>
        </span>
        <p className="text-[13.5px] font-medium text-ink">{message}</p>
      </div>
    </div>,
    document.body,
  )
}
