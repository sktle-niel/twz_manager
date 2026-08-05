import { useEffect, useState } from "react"
import { PlusIcon, ReceiptIcon, XIcon } from "@phosphor-icons/react"
import { newReceiptEntry } from "../lib/receipts"
import type { ReceiptEntry } from "../lib/receipts"

function Thumb({ entry, onRemove }: { entry: ReceiptEntry; onRemove: () => void }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!entry.file) {
      setFileUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(entry.file)
    setFileUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [entry.file])

  /* A photo picked this session previews from the file; one already stored
     previews from the backend's own URL */
  const url = fileUrl ?? entry.url

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-canvas">
      {url ? (
        <img src={url} alt="Receipt photo" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-mute">
          <ReceiptIcon size={20} weight="bold" aria-hidden="true" />
          <span className="text-[11px] font-medium">On file</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove receipt"
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white transition-colors duration-200 ease-quiet hover:bg-ink"
      >
        <XIcon size={12} weight="bold" aria-hidden="true" />
      </button>
    </div>
  )
}

export function ReceiptUploader({
  inputId,
  label,
  hint,
  entries,
  onChange,
  error,
  max = 5,
}: {
  inputId: string
  label: string
  hint?: string
  entries: ReceiptEntry[]
  onChange: (entries: ReceiptEntry[]) => void
  error?: string
  max?: number
}) {
  const remaining = max - entries.length

  function addFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list).slice(0, remaining)
    if (picked.length === 0) return
    onChange([...entries, ...picked.map(newReceiptEntry)])
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        <span className="text-[12px] tabular-nums text-mute">
          {entries.length}/{max}
        </span>
      </div>
      {hint && !error && <p className="mt-0.5 text-[12px] text-mute">{hint}</p>}

      <div
        role="group"
        aria-label={label}
        className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5"
      >
        {entries.map((entry) => (
          <Thumb
            key={entry.id}
            entry={entry}
            onRemove={() => onChange(entries.filter((e) => e.id !== entry.id))}
          />
        ))}

        {remaining > 0 && (
          <label
            className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed transition-colors duration-200 ease-quiet focus-within:border-brand-deep focus-within:shadow-[0_0_0_2px_rgba(30,125,27,0.8)] ${
              error ? "border-claret/60 text-claret" : "border-line-strong text-mute hover:border-mute hover:text-ink"
            }`}
          >
            <input
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              aria-describedby={error ? `${inputId}-error` : undefined}
              onChange={(e) => {
                addFiles(e.target.files)
                // Reset so the same file can be chosen again after removal
                e.target.value = ""
              }}
            />
            <PlusIcon size={18} weight="bold" aria-hidden="true" />
            <span className="text-[11px] font-medium">Add photo</span>
          </label>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-[13px] text-claret">
          {error}
        </p>
      )}
    </div>
  )
}
