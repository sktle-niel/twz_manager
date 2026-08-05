import { useEffect, useRef, useState } from "react"
import { CameraIcon, ImageSquareIcon, XIcon } from "@phosphor-icons/react"
import { documentMetrics, documentVerdict } from "../lib/slipCheck"

/*
 * In-app capture for the deposit slip.
 *
 * The point of shooting here rather than handing off to the gallery is the
 * live guide: the same measurements that decide whether a filed photo is a
 * document run on the preview a few times a second, so the manager is steered
 * to a usable frame instead of being told afterwards that the one they took is
 * no good. The shutter is never disabled on that reading — it is guidance, and
 * a manager who needs the shot must always be able to take it.
 */

/* Judged this often; the measurement is cheap but the preview is not worth
   stealing frames from */
const GUIDE_MS = 400
/* Live judging runs on a small square, the same size the filed check uses */
const GUIDE_SIZE = 128

type Guide = { tone: "ok" | "busy"; text: string }

const GUIDES: Record<string, Guide> = {
  none: { tone: "busy", text: "Point the camera at the deposit slip" },
  closer: { tone: "busy", text: "Fill the frame with the slip" },
  faint: { tone: "busy", text: "Get closer so the printing shows" },
  ready: { tone: "ok", text: "Looks good, hold steady" },
}

export function SlipCamera({
  onCapture,
  onPickFile,
  onClose,
}: {
  onCapture: (file: File) => void
  onPickFile: () => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [guide, setGuide] = useState<Guide>(GUIDES.none)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    // Undefined outside a secure context, which is the usual reason this fails
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser will not open the camera here. It needs a secure (https) connection. Attach the photo from the gallery instead.",
      )
      return
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          void videoRef.current.play()
        }
        setLive(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const name = err instanceof Error ? err.name : ""
        setError(
          name === "NotAllowedError"
            ? "Camera access was declined. Allow it in your browser settings, or attach the photo from the gallery."
            : name === "NotFoundError"
              ? "No camera found on this device. Attach the photo from the gallery instead."
              : "The camera could not be opened. Attach the photo from the gallery instead.",
        )
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  /* Judge the preview on the same measurements the filed photo will face */
  useEffect(() => {
    if (!live) return
    const canvas = document.createElement("canvas")
    canvas.width = GUIDE_SIZE
    canvas.height = GUIDE_SIZE
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const timer = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      ctx.drawImage(video, 0, 0, GUIDE_SIZE, GUIDE_SIZE)
      const m = documentMetrics(ctx.getImageData(0, 0, GUIDE_SIZE, GUIDE_SIZE).data, GUIDE_SIZE)
      const verdict = documentVerdict(m)
      setGuide(
        verdict === "document"
          ? GUIDES.ready
          : m.coverage < 0.05
            ? GUIDES.none
            : verdict === "poor"
              ? GUIDES.closer
              : GUIDES.faint,
      )
    }, GUIDE_MS)

    return () => window.clearInterval(timer)
  }, [live])

  function shoot() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(
          new File([blob], `deposit-slip-${Date.now()}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        )
      },
      "image/jpeg",
      0.92,
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink"
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo of the deposit slip"
    >
      <div className="flex items-center justify-between px-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-white/80 transition-colors duration-200 ease-quiet hover:text-white"
        >
          <XIcon size={22} weight="bold" aria-hidden="true" />
        </button>
        <span className="text-[13.5px] font-medium text-white/80">Deposit slip</span>
        <span className="h-11 w-11" aria-hidden="true" />
      </div>

      <div className="relative min-h-0 flex-1">
        {error ? (
          <div className="flex h-full items-center justify-center px-8">
            <p className="max-w-sm text-center text-[14px] leading-[1.6] text-white/80">{error}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              aria-label="Camera preview"
            />
            {/* Where to put the slip. Aspect roughly that of a deposit slip. */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-6 top-1/2 aspect-[4/3] -translate-y-1/2 rounded-xl border-2 transition-colors duration-300 ease-quiet ${
                guide.tone === "ok" ? "border-brand" : "border-white/45"
              }`}
            />
            <p
              role="status"
              className={`absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-300 ease-quiet ${
                guide.tone === "ok" ? "bg-brand text-ink" : "bg-ink/70 text-white"
              }`}
            >
              {guide.text}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
        <button
          type="button"
          onClick={onPickFile}
          className="flex items-center gap-1.5 text-[13.5px] font-medium text-white/80 transition-colors duration-200 ease-quiet hover:text-white"
        >
          <ImageSquareIcon size={18} aria-hidden="true" />
          Gallery
        </button>

        <button
          type="button"
          onClick={shoot}
          disabled={!live}
          aria-label="Take the photo"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink ring-4 ring-white/25 transition-transform duration-200 ease-quiet active:scale-95 disabled:opacity-40"
        >
          <CameraIcon size={26} weight="fill" aria-hidden="true" />
        </button>

        <span className="w-[4.5rem]" aria-hidden="true" />
      </div>
    </div>
  )
}
