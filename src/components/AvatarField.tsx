import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { CameraIcon } from "@phosphor-icons/react"
import { DUR, EASE, prefersReducedMotion } from "../lib/motion"
import { STOCK_AVATARS, stockAvatar } from "../lib/avatar"
import type { AvatarKind } from "../lib/api"

/*
 * The profile picture, in the account's own hands: pick one of the two stock
 * avatars, or upload a photo. An uploaded photo always wins; removing it
 * falls back to whichever stock face is chosen. Girl is the default for
 * every account until its owner says otherwise.
 */
const KIND_LABELS: Record<AvatarKind, string> = {
  girl: "Girl avatar",
  boy: "Boy avatar",
}

export function AvatarField({
  id,
  name,
  avatarKind,
  onAvatarKind,
  file,
  existingUrl = null,
  onChange,
  onRemoveExisting,
  hint,
}: {
  id: string
  name: string
  /** The stock face shown while no photo is uploaded */
  avatarKind: AvatarKind
  onAvatarKind: (kind: AvatarKind) => void
  file: File | null
  /** Photo already stored by the backend, shown until a new file replaces it */
  existingUrl?: string | null
  onChange: (file: File | null) => void
  /** Called when the stored photo itself is removed */
  onRemoveExisting?: () => void
  hint?: string
}) {
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const frameRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  /* The new file wins over the stored photo; the stored one wins over stock */
  const uploaded = filePreview ?? existingUrl
  const shown = uploaded ?? stockAvatar(avatarKind)

  /* A small settle whenever the picture changes, so a swap reads as deliberate */
  useGSAP(
    () => {
      if (!frameRef.current || prefersReducedMotion()) return
      gsap.from(frameRef.current, {
        opacity: 0,
        scale: 0.92,
        duration: DUR.rise,
        ease: EASE,
        clearProps: "opacity,transform",
      })
    },
    { dependencies: [shown], revertOnUpdate: true },
  )

  const actionClass =
    "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"

  return (
    <div className="flex items-center gap-4">
      <span
        ref={frameRef}
        role="img"
        aria-label={uploaded ? `${name} profile photo` : `${name}, ${KIND_LABELS[avatarKind]}`}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-sage ring-1 ring-line"
      >
        <img src={shown} alt="" className="h-full w-full object-cover" draggable={false} />
      </span>

      <div className="min-w-0">
        <span className="text-[13px] font-medium text-ink-soft">Profile photo</span>
        {hint && <p className="mt-0.5 text-[12.5px] text-mute">{hint}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* The stock choice, girl first because girl is the default. Hidden
              while a photo is up: the photo wins, so the choice would be a
              button that visibly does nothing. */}
          {!uploaded &&
            (Object.keys(STOCK_AVATARS) as AvatarKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onAvatarKind(kind)}
                aria-label={KIND_LABELS[kind]}
                aria-pressed={avatarKind === kind}
                title={KIND_LABELS[kind]}
                className={`h-9 w-9 shrink-0 overflow-hidden rounded-full transition-shadow duration-200 ease-quiet ${
                  avatarKind === kind
                    ? "ring-2 ring-brand-deep"
                    : "ring-1 ring-line hover:ring-line-strong"
                }`}
              >
                <img
                  src={STOCK_AVATARS[kind]}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </button>
            ))}

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
            {uploaded ? "Replace" : "Add photo"}
          </label>
          {uploaded && (
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
