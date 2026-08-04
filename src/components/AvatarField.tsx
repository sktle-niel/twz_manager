import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { CameraIcon, UserIcon } from "@phosphor-icons/react"
import { DUR, EASE, prefersReducedMotion } from "../lib/motion"
import { initials } from "../lib/format"

/*
 * Optional profile photo. With no file attached the avatar falls back to the
 * account's own initials, drawn one character at a time — keyed on the letters,
 * so editing the name field above replays it and the empty state reads as
 * deliberate rather than as a missing image.
 *
 * The letters carry their own beat rather than reusing useRouteReveal: that
 * hook animates whole [data-rise] sections on navigation, and this needs to
 * replay mid-page whenever the name changes.
 */
const MARK_STAGGER = 0.1

export function AvatarField({
  id,
  name,
  file,
  existingUrl = null,
  onChange,
  onRemoveExisting,
  hint,
}: {
  id: string
  name: string
  file: File | null
  /** Photo already stored by the backend, shown until a new file replaces it */
  existingUrl?: string | null
  onChange: (file: File | null) => void
  /** Called when the stored photo itself is removed */
  onRemoveExisting?: () => void
  hint?: string
}) {
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const marksRef = useRef<HTMLSpanElement>(null)
  const letters = initials(name)

  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  /* The new file wins over the stored photo; the stored one wins over initials */
  const preview = filePreview ?? existingUrl

  useGSAP(
    () => {
      const marks = marksRef.current?.querySelectorAll("[data-mark]")
      if (!marks?.length || prefersReducedMotion()) return
      gsap.from(marks, {
        opacity: 0,
        y: 10,
        duration: DUR.rise,
        ease: EASE,
        stagger: MARK_STAGGER,
        clearProps: "opacity,transform",
      })
    },
    { dependencies: [letters, preview], revertOnUpdate: true },
  )

  const actionClass =
    "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"

  return (
    <div className="flex items-center gap-4">
      <span
        role="img"
        aria-label={preview ? `${name} profile photo` : `${name}, no photo attached`}
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage"
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : letters ? (
          <span
            ref={marksRef}
            aria-hidden="true"
            className="flex text-[20px] font-semibold tracking-[-0.02em] text-sage-ink"
          >
            {letters.split("").map((ch, i) => (
              <span key={`${ch}-${i}`} data-mark className="inline-block">
                {ch}
              </span>
            ))}
          </span>
        ) : (
          <UserIcon size={26} aria-hidden="true" className="text-sage-ink" />
        )}
      </span>

      <div className="min-w-0">
        <span className="text-[13px] font-medium text-ink-soft">Profile photo</span>
        {hint && <p className="mt-0.5 text-[12.5px] text-mute">{hint}</p>}
        <div className="mt-2 flex items-center gap-2">
          <input
            id={id}
            type="file"
            accept="image/*"
            className="peer sr-only"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor={id}
            className={`${actionClass} peer-focus-visible:border-brand-deep peer-focus-visible:shadow-[0_0_0_2px_rgba(30,125,27,0.8)]`}
          >
            <CameraIcon size={15} aria-hidden="true" />
            {preview ? "Replace" : "Add photo"}
          </label>
          {preview && (
            <button
              type="button"
              onClick={() => {
                if (file) onChange(null)
                else onRemoveExisting?.()
              }}
              className={actionClass}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
