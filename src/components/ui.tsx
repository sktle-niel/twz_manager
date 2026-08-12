import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { CameraIcon, ImageSquareIcon, StorefrontIcon, XIcon } from "@phosphor-icons/react"
import { Select } from "./Select"
import type { SelectOption } from "./Select"

/* 16px on touch widths: WebKit zooms into focused controls below 16px */
export const inputBase =
  "mt-2 w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[16px] text-ink placeholder:text-mute outline-none transition-[border-color,box-shadow] duration-200 ease-quiet lg:text-[15px]"
/* Same field styling without the top margin or fixed width, for inline rows
   where the caller sets its own width (flex-1, w-24, …) */
export const inputFlush =
  "rounded-lg border bg-surface px-3.5 py-2.5 text-[16px] text-ink placeholder:text-mute outline-none transition-[border-color,box-shadow] duration-200 ease-quiet lg:text-[15px]"
export const inputOk =
  "border-line-strong hover:border-mute focus:border-brand-deep focus:shadow-[0_0_0_2px_rgba(30,125,27,0.8)]"
export const inputBad =
  "border-claret/60 focus:border-claret focus:shadow-[0_0_0_2px_rgba(179,57,47,0.8)]"

export const controlClass =
  "appearance-none rounded-lg border border-line-strong bg-surface py-2 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-quiet focus:border-brand-deep focus:shadow-[0_0_0_2px_rgba(30,125,27,0.8)] lg:text-[14px]"

/*
 * Two-or-three-way scope switch, faster than opening a dropdown: the tabs
 * are all visible, one tap swaps the view. Sized to sit level with the
 * FilterSelect pills it shares a row with.
 */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  ariaLabel: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-lg border border-line-strong bg-surface p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3.5 py-[7px] text-[13.5px] font-medium transition-colors duration-200 ease-quiet ${
            o.value === value ? "bg-sage text-sage-ink" : "text-mute hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* Read-only branch indicator, shown where a manager page once had a branch
   picker — a manager is locked to their assigned branch. */
export function BranchTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[14px] font-medium text-ink-soft">
      <StorefrontIcon size={15} weight="bold" aria-hidden="true" className="text-mute" />
      {name} branch
    </span>
  )
}

export function FilterSelect({
  ariaLabel,
  icon,
  value,
  onChange,
  options,
  className,
  disabled,
}: {
  ariaLabel: string
  icon?: ReactNode
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  disabled?: boolean
}) {
  return (
    <Select
      variant="filter"
      ariaLabel={ariaLabel}
      icon={icon}
      value={value}
      onChange={onChange}
      options={options}
      className={className}
      disabled={disabled}
    />
  )
}

export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[12.5px] text-mute">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] text-claret">
          {error}
        </p>
      )}
    </div>
  )
}

export function PhotoAttach({
  id,
  label,
  hint,
  file,
  onChange,
  error,
  /* Given a handler, the field offers to shoot the photo in the app rather
     than only accepting one already in the gallery */
  onCapture,
}: {
  id: string
  label: string
  hint?: string
  file: File | null
  onChange: (file: File | null) => void
  error?: string
  onCapture?: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div>
      <span className="text-[13px] font-medium text-ink-soft">{label}</span>
      <input
        id={id}
        type="file"
        accept="image/*"
        className="peer sr-only"
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 peer-focus-visible:border-brand-deep peer-focus-visible:shadow-[0_0_0_2px_rgba(30,125,27,0.8)]">
          {preview && (
            <img src={preview} alt="Attached photo preview" className="h-12 w-12 rounded-md object-cover" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-ink">{file.name}</span>
            <span className="block text-[12px] text-mute">
              {Math.max(1, Math.round(file.size / 1024))} KB
            </span>
          </span>
          {onCapture && (
            <button
              type="button"
              onClick={onCapture}
              className="rounded-md px-2 py-1.5 text-[13px] font-medium text-brand-deep underline-offset-4 hover:underline"
            >
              Retake
            </button>
          )}
          <label
            htmlFor={id}
            className="cursor-pointer rounded-md px-2 py-1.5 text-[13px] font-medium text-brand-deep underline-offset-4 hover:underline"
          >
            Replace
          </label>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove attachment"
            className="flex h-9 w-9 items-center justify-center rounded-md text-mute transition-colors duration-200 ease-quiet hover:text-ink"
          >
            <XIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>
      ) : onCapture ? (
        /* Shooting it here is the path that gets a usable photo, so it leads;
           the gallery stays available for a slip already photographed */
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onCapture}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3.5 py-3 text-[14px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03] ${
              error ? "border-claret/60" : "border-line-strong"
            }`}
          >
            <CameraIcon size={19} weight="bold" aria-hidden="true" />
            Take photo
          </button>
          <label
            htmlFor={id}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-3.5 py-3 text-[14px] font-medium text-ink-soft transition-colors duration-200 ease-quiet hover:border-mute peer-focus-visible:border-brand-deep peer-focus-visible:shadow-[0_0_0_2px_rgba(30,125,27,0.8)]"
          >
            <ImageSquareIcon size={19} aria-hidden="true" className="text-mute" />
            From gallery
          </label>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`mt-2 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3.5 py-3 transition-colors duration-200 ease-quiet peer-focus-visible:border-brand-deep peer-focus-visible:shadow-[0_0_0_2px_rgba(30,125,27,0.8)] ${
            error ? "border-claret/60" : "border-line-strong hover:border-mute"
          }`}
        >
          <CameraIcon size={20} className="text-mute" aria-hidden="true" />
          <span>
            <span className="block text-[13.5px] font-medium text-ink-soft">Attach photo</span>
            {hint && <span className="block text-[12px] text-mute">{hint}</span>}
          </span>
        </label>
      )}
      {onCapture && hint && !error && !file && (
        <p className="mt-1.5 text-[12.5px] text-mute">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] text-claret">
          {error}
        </p>
      )}
    </div>
  )
}
