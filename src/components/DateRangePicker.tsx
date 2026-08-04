import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  CalendarBlankIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react"
import {
  PRESETS,
  addDays,
  endOfMonth,
  matchPreset,
  parseInputDate,
  presetRange,
  rangeLabel,
  sameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "../lib/dateRange"
import type { DateRange, PresetKey } from "../lib/dateRange"
import { dayKey } from "../lib/dateRange"
import { useSheetEnter } from "../lib/motion"
import { controlClass } from "./ui"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const PANEL_WIDTH = 544
const GUTTER = 16

type Draft = { start: Date; end: Date | null }

function fullDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function DateRangePicker({
  value,
  onChange,
  today,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
  today: Date
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const backdropRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>({ start: value.start, end: value.end })
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value.end))
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  useSheetEnter(panelRef, backdropRef, open)

  function openPicker() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.bottom + 8, left: rect.left })
    setDraft({ start: value.start, end: value.end })
    setViewMonth(startOfMonth(value.end))
    setOpen(true)
  }

  function pickDay(d: Date) {
    if (d > today) return
    setDraft((prev) => {
      // A finished range, or a click before the start, begins a new range
      if (prev.end !== null || d < prev.start) return { start: d, end: null }
      return { start: prev.start, end: d }
    })
  }

  function applyPreset(key: PresetKey) {
    const r = presetRange(key, today)
    setDraft({ start: r.start, end: r.end })
    setViewMonth(startOfMonth(r.end))
  }

  function commit() {
    onChange({ start: draft.start, end: draft.end ?? draft.start })
    setOpen(false)
  }

  const selStart = draft.start
  const selEnd = draft.end ?? draft.start
  const activePreset = matchPreset({ start: selStart, end: selEnd }, today)

  // Full weeks covering the displayed month
  const gridStart = startOfWeek(viewMonth)
  const gridEnd = addDays(startOfWeek(endOfMonth(viewMonth)), 6)
  const cells: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(d)

  const atCurrentMonth =
    viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() === today.getMonth()

  // Rendered in a portal: an ancestor holds a transform while its entry
  // animation runs, which would otherwise trap position:fixed inside it.
  const panelClass = isDesktop
    ? "fixed z-50 overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-[0_8px_28px_rgba(21,22,19,0.12)]"
    : "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"

  const panelStyle =
    isDesktop && anchor
      ? {
          top: anchor.top,
          left: Math.max(
            GUTTER,
            Math.min(anchor.left, window.innerWidth - PANEL_WIDTH - GUTTER),
          ),
          width: PANEL_WIDTH,
          maxHeight: Math.max(240, window.innerHeight - anchor.top - GUTTER),
        }
      : undefined

  return (
    <>
      <span ref={triggerRef} className="relative inline-flex items-center">
        <span className="pointer-events-none absolute left-3 z-10 text-mute">
          <CalendarBlankIcon size={15} weight="bold" aria-hidden="true" />
        </span>
        <button
          type="button"
          onClick={openPicker}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`${controlClass} pl-9 pr-8 text-left`}
        >
          {rangeLabel(value, today)}
        </button>
        <CaretDownIcon
          size={13}
          weight="bold"
          aria-hidden="true"
          className="pointer-events-none absolute right-3 text-mute"
        />
      </span>

      {open &&
        createPortal(
          <>
            <button
              ref={backdropRef}
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-ink/25 sm:bg-ink/10"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Select date range"
              className={panelClass}
              style={panelStyle}
            >
              <div className="sm:flex sm:items-stretch">
                {/* Calendar */}
                <div className="sm:flex-1 sm:pr-4">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
                      }
                      aria-label="Previous month"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
                    >
                      <CaretLeftIcon size={15} weight="bold" aria-hidden="true" />
                    </button>
                    <span aria-live="polite" className="text-[14px] font-medium text-ink">
                      {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      type="button"
                      disabled={atCurrentMonth}
                      onClick={() =>
                        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
                      }
                      aria-label="Next month"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-mute transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                    >
                      <CaretRightIcon size={15} weight="bold" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-7">
                    {WEEKDAYS.map((w) => (
                      <span
                        key={w}
                        aria-hidden="true"
                        className="py-1.5 text-center text-[11.5px] font-medium text-mute"
                      >
                        {w}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {cells.map((d) => {
                      const disabled = d > today
                      const isStart = sameDay(d, selStart)
                      const isEnd = sameDay(d, selEnd)
                      const inRange = d >= selStart && d <= selEnd && !disabled
                      const outside = d.getMonth() !== viewMonth.getMonth()
                      const isToday = sameDay(d, today)

                      let dayClass: string
                      if (isStart || isEnd) {
                        dayClass = "bg-brand-deep font-semibold text-white"
                      } else if (disabled) {
                        dayClass = "cursor-not-allowed text-mute/40"
                      } else if (outside) {
                        dayClass = "text-mute hover:bg-black/[0.06]"
                      } else {
                        dayClass = "text-ink-soft hover:bg-black/[0.06]"
                      }

                      return (
                        <span
                          key={dayKey(d)}
                          className={`py-0.5 ${inRange ? "bg-sage" : ""} ${
                            inRange && isStart ? "rounded-l-full" : ""
                          } ${inRange && isEnd ? "rounded-r-full" : ""}`}
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => pickDay(d)}
                            aria-label={fullDate(d)}
                            aria-pressed={isStart || isEnd}
                            aria-current={isToday ? "date" : undefined}
                            className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors duration-150 ease-quiet ${dayClass} ${
                              isToday && !isStart && !isEnd ? "ring-1 ring-line-strong" : ""
                            }`}
                          >
                            {d.getDate()}
                          </button>
                        </span>
                      )
                    })}
                  </div>

                  {/* Typed start / end */}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <span>
                      <label htmlFor="range-start" className="text-[12px] font-medium text-mute">
                        Start date
                      </label>
                      <input
                        id="range-start"
                        type="date"
                        value={dayKey(selStart)}
                        max={dayKey(selEnd)}
                        onChange={(e) => {
                          const d = parseInputDate(e.target.value)
                          if (d) setDraft({ start: startOfDay(d), end: selEnd })
                        }}
                        className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-quiet focus:border-brand-deep focus:shadow-[0_0_0_2px_rgba(30,125,27,0.8)] lg:text-[13.5px]"
                      />
                    </span>
                    <span>
                      <label htmlFor="range-end" className="text-[12px] font-medium text-mute">
                        End date
                      </label>
                      <input
                        id="range-end"
                        type="date"
                        value={dayKey(selEnd)}
                        min={dayKey(selStart)}
                        max={dayKey(today)}
                        onChange={(e) => {
                          const d = parseInputDate(e.target.value)
                          if (d) setDraft({ start: selStart, end: startOfDay(d) })
                        }}
                        className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[16px] text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-quiet focus:border-brand-deep focus:shadow-[0_0_0_2px_rgba(30,125,27,0.8)] lg:text-[13.5px]"
                      />
                    </span>
                  </div>
                </div>

                {/* Presets */}
                <div className="mt-4 border-t border-line pt-3 sm:mt-0 sm:w-40 sm:shrink-0 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-1">
                    {PRESETS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyPreset(p.key)}
                        className={`rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors duration-200 ease-quiet ${
                          activePreset === p.key
                            ? "bg-sage font-medium text-sage-ink"
                            : "text-ink-soft hover:bg-black/[0.04] hover:text-ink"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-10 items-center justify-center rounded-lg px-4 text-[14px] font-medium text-ink-soft transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commit}
                  className="flex h-10 items-center justify-center rounded-lg bg-ink px-5 text-[14px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985]"
                >
                  Done
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
