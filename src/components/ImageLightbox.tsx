import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, XIcon } from "@phosphor-icons/react"

/*
 * Full-screen viewer for one photo — the deposit slip must be readable down
 * to the dot-matrix line, and a card-sized preview cannot be. Zoom rides the
 * pointer: wheel and double-tap anchor at the cursor, a pinch anchors at its
 * midpoint, and a drag pans once zoomed. At 1:1 the frame recentres itself.
 */
type Transform = { scale: number; x: number; y: number }

const MIN_SCALE = 1
const MAX_SCALE = 6
const RESTING: Transform = { scale: 1, x: 0, y: 0 }

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  const [t, setT] = useState<Transform>(RESTING)
  const frameRef = useRef<HTMLDivElement>(null)
  /* Live pointer positions, for pan (one) and pinch (two) */
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  /* Native listener: React's onWheel cannot preventDefault the page zoom */
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2)
    }
    frame.addEventListener("wheel", onWheel, { passive: false })
    return () => frame.removeEventListener("wheel", onWheel)
  }, [])

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    setT((prev) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor))
      if (scale <= 1) return RESTING
      /* Keep the image point under the pointer fixed while the scale moves:
         p - t' = ((p - t) / s) * s'  →  t' = p - (p - t) * (s'/s) */
      const px = clientX - rect.left - rect.width / 2
      const py = clientY - rect.top - rect.height / 2
      const ratio = scale / prev.scale
      return { scale, x: px - (px - prev.x) * ratio, y: py - (py - prev.y) * ratio }
    })
  }

  function zoomCentered(factor: number) {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
  }

  function onPointerDown(e: React.PointerEvent) {
    frameRef.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  function onPointerMove(e: React.PointerEvent) {
    const held = pointers.current
    const last = held.get(e.pointerId)
    if (!last) return

    if (held.size === 2) {
      const [a, b] = [...held.entries()]
      const other = a[0] === e.pointerId ? b[1] : a[1]
      const before = Math.hypot(last.x - other.x, last.y - other.y)
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      if (before > 0) {
        zoomAt((e.clientX + other.x) / 2, (e.clientY + other.y) / 2, after / before)
      }
    } else if (held.size === 1 && t.scale > 1) {
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      setT((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
    held.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  function onPointerEnd(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
  }

  const percent = `${Math.round(t.scale * 100)}%`

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[60] bg-ink/90"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <div
        ref={frameRef}
        className="flex h-full w-full touch-none items-center justify-center overflow-hidden"
        style={{ cursor: t.scale > 1 ? "grab" : "zoom-in" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={(e) =>
          t.scale > 1 ? setT(RESTING) : zoomAt(e.clientX, e.clientY, 2.5)
        }
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
            transformOrigin: "center",
          }}
        />
      </div>

      {/* The controls float above the frame, out of the gesture's way */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/70 p-1.5 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => zoomCentered(1 / 1.4)}
          aria-label="Zoom out"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors duration-200 ease-quiet hover:bg-white/15 hover:text-white"
        >
          <MagnifyingGlassMinusIcon size={17} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setT(RESTING)}
          aria-label="Reset zoom"
          className="min-w-12 rounded-full px-1 text-center text-[12px] font-medium tabular-nums text-white/85 transition-colors duration-200 ease-quiet hover:text-white"
        >
          {percent}
        </button>
        <button
          type="button"
          onClick={() => zoomCentered(1.4)}
          aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors duration-200 ease-quiet hover:bg-white/15 hover:text-white"
        >
          <MagnifyingGlassPlusIcon size={17} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the photo"
          className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 ease-quiet hover:bg-white/25"
        >
          <XIcon size={17} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
