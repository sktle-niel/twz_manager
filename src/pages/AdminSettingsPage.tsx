import { useState } from "react"
import type { CSSProperties, ReactNode, SubmitEvent } from "react"
import {
  CheckCircleIcon,
  PlugsConnectedIcon,
  PlusIcon,
  ShieldCheckIcon,
  StorefrontIcon,
  TagIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { STORES } from "../lib/mock"
import { inputFlush, inputOk } from "../components/ui"

function SettingCard({
  icon: CardIcon,
  title,
  subtitle,
  index,
  children,
}: {
  icon: Icon
  title: string
  subtitle: string
  index: number
  children: ReactNode
}) {
  return (
    <section
      className="anim-rise rounded-xl border border-line bg-surface p-5 sm:p-6"
      style={{ "--index": index } as CSSProperties}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sage text-sage-ink">
          <CardIcon size={18} weight="bold" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[13px] text-mute">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function AdminSettingsPage() {
  const [categories, setCategories] = useState([
    "Meals",
    "Merienda",
    "Water bill",
    "Electric bill",
    "Wifi bill",
    "Other",
  ])
  const [newCategory, setNewCategory] = useState("")
  const [batchWindow, setBatchWindow] = useState("3")
  const [reconnected, setReconnected] = useState(false)
  const [rulesSaved, setRulesSaved] = useState(false)

  function addCategory(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = newCategory.trim()
    if (!value || categories.some((c) => c.toLowerCase() === value.toLowerCase())) return
    setCategories((prev) => [...prev, value])
    setNewCategory("")
  }

  async function saveRules(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    // TODO: persist to the real API once the backend exists
    setRulesSaved(true)
    window.setTimeout(() => setRulesSaved(false), 3000)
  }

  return (
    <>
      <div className="anim-rise mt-6" style={{ "--index": 0 } as CSSProperties}>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Settings</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Branches, the POS connection, and how deposits are reconciled.
        </p>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Branches */}
        <SettingCard
        icon={StorefrontIcon}
        title="Branches"
        subtitle="Stores audited in TWZ Manager. Sales are pulled from Loyverse per branch."
        index={1}
      >
        <ul className="divide-y divide-line rounded-lg border border-line">
          {STORES.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[14px] font-medium text-ink-soft">{s.name}</span>
              <span className="inline-flex items-center gap-1 text-[12px] text-mute">
                <CheckCircleIcon size={13} weight="fill" className="text-sage-ink" aria-hidden="true" />
                Loyverse-linked
              </span>
            </li>
          ))}
        </ul>
      </SettingCard>

      {/* Loyverse POS integration */}
      <SettingCard
        icon={PlugsConnectedIcon}
        title="Loyverse POS"
        subtitle="The source of truth for daily sales in every branch."
        index={2}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink">
              <CheckCircleIcon size={12} weight="fill" aria-hidden="true" />
              Connected
            </span>
            <p className="mt-1.5 text-[12.5px] text-mute">
              {STORES.length} of {STORES.length} branches synced · token ending 4821
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setReconnected(true)
              window.setTimeout(() => setReconnected(false), 3000)
            }}
            className="flex h-10 items-center justify-center rounded-lg border border-line-strong px-4 text-[13.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
          >
            Reconnect
          </button>
        </div>
        {reconnected && (
          <p role="status" className="mt-2 text-[13px] font-medium text-sage-ink">
            Connection refreshed.
          </p>
        )}
      </SettingCard>

      {/* Expense categories */}
      <SettingCard
        icon={TagIcon}
        title="Expense categories"
        subtitle="Categories managers pick from when logging an expense."
        index={3}
      >
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full border border-line bg-canvas px-3 py-1 text-[13px] font-medium text-ink-soft"
            >
              {c}
            </span>
          ))}
        </div>
        <form onSubmit={addCategory} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            aria-label="New category"
            placeholder="Add a category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className={`${inputFlush} ${inputOk} flex-1`}
          />
          <button
            type="submit"
            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-4 text-[14px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
          >
            <PlusIcon size={15} weight="bold" aria-hidden="true" />
            Add
          </button>
        </form>
      </SettingCard>

      {/* Reconciliation rules */}
      <SettingCard
        icon={ShieldCheckIcon}
        title="Reconciliation"
        subtitle="How the app matches bank deposits against expected amounts."
        index={4}
      >
        <div className="flex items-start justify-between gap-3 rounded-lg border border-line px-4 py-3">
          <div>
            <p className="text-[14px] font-medium text-ink-soft">
              Require a discrepancy form on mismatch
            </p>
            <p className="mt-0.5 text-[12.5px] text-mute">
              A mismatched deposit can never be closed silently — the reason and a receipt are always
              required.
            </p>
          </div>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink">
            <CheckCircleIcon size={12} weight="fill" aria-hidden="true" />
            Always on
          </span>
        </div>

        <form onSubmit={saveRules} className="mt-4">
          <label htmlFor="batch-window" className="text-[13px] font-medium text-ink-soft">
            Deposit batching window (days)
          </label>
          <p className="mt-0.5 text-[12.5px] text-mute">
            How many audited days a single bank deposit may cover before one is expected.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="batch-window"
              type="number"
              min={1}
              max={14}
              inputMode="numeric"
              value={batchWindow}
              onChange={(e) => setBatchWindow(e.target.value)}
              className={`${inputFlush} ${inputOk} w-24`}
            />
            <button
              type="submit"
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-[14.5px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985]"
            >
              Save
            </button>
            {rulesSaved && (
              <p role="status" className="text-[13px] font-medium text-sage-ink">
                Settings saved.
              </p>
            )}
          </div>
        </form>
        </SettingCard>
      </div>
    </>
  )
}
