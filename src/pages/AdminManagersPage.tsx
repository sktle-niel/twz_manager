import { useState } from "react"
import type { CSSProperties, SubmitEvent } from "react"
import { LockIcon, LockOpenIcon, StorefrontIcon } from "@phosphor-icons/react"
import { MANAGERS, STORES } from "../lib/mock"
import type { Manager } from "../lib/mock"
import { FilterSelect, FormField, inputBad, inputBase, inputOk } from "../components/ui"
import { Select } from "../components/Select"
import type { SelectOption } from "../components/Select"
import { Toast } from "../components/Toast"

type FieldErrors = { name?: string; email?: string }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

function ManagerRow({
  manager,
  options,
  locked,
  onToggleLock,
  onBranchChange,
}: {
  manager: Manager
  /* Every branch: their own, the free ones, and occupied ones (which swap) */
  options: SelectOption[]
  locked: boolean
  onToggleLock: () => void
  onBranchChange: (storeId: string) => void
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-[12px] font-semibold text-sage-ink">
        {initials(manager.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink-soft">{manager.name}</span>
          {!manager.active && (
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-mute">
              Disabled
            </span>
          )}
        </span>
        <span className="block truncate text-[12px] text-mute">{manager.email}</span>
      </span>
      <FilterSelect
        ariaLabel={`Branch for ${manager.name}`}
        icon={<StorefrontIcon size={15} weight="bold" aria-hidden="true" />}
        value={manager.storeId}
        onChange={onBranchChange}
        options={options}
        disabled={locked}
        className="w-44"
      />
      <button
        type="button"
        onClick={onToggleLock}
        aria-pressed={locked}
        aria-label={
          locked ? `Unlock branch for ${manager.name}` : `Lock branch for ${manager.name}`
        }
        title={locked ? "Locked — click to allow changes" : "Unlocked — click to lock"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ease-quiet hover:bg-black/[0.04] ${
          locked ? "text-mute hover:text-ink" : "text-brand-deep"
        }`}
      >
        {locked ? (
          <LockIcon size={16} weight="fill" aria-hidden="true" />
        ) : (
          <LockOpenIcon size={16} weight="bold" aria-hidden="true" />
        )}
      </button>
    </li>
  )
}

export default function AdminManagersPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [branch, setBranch] = useState(STORES[0].id)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState<Manager[]>([])
  // Branch reassignments layered over the base list, keyed by manager id, so
  // an existing account can be moved without editing the underlying data
  const [branchOverride, setBranchOverride] = useState<Record<string, string>>({})
  // Locked by default so a stray click never moves a manager; the admin
  // unlocks a row deliberately before reassigning it
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)

  const showToast = (message: string) => setToast({ id: Date.now(), message })
  const isLocked = (id: string) => locked[id] ?? true
  const toggleLock = (id: string) => setLocked((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))

  const managers: Manager[] = [...added, ...MANAGERS].map((m) => ({
    ...m,
    storeId: branchOverride[m.id] ?? m.storeId,
  }))

  // One branch per manager: a branch is taken by whoever currently holds it
  const takenBy: Record<string, string> = {}
  for (const m of managers) takenBy[m.storeId] = m.id
  const freeStores = STORES.filter((s) => !takenBy[s.id])
  const storeName = (storeId: string) => STORES.find((s) => s.id === storeId)?.name ?? storeId

  // Every branch is offered for reassignment: the manager's own, the free ones,
  // and those held by someone else — picking an occupied branch swaps the two,
  // which is how a wrong assignment gets corrected without ever doubling up.
  const optionsFor = (m: Manager): SelectOption[] =>
    STORES.flatMap((s) => {
      const holder = managers.find((x) => x.id !== m.id && x.storeId === s.id)
      // A locked manager can't be swapped out, so drop their branch as a target
      if (holder && isLocked(holder.id)) return []
      return [{ value: s.id, label: s.name, hint: holder ? `Held by ${holder.name} · swaps` : undefined }]
    })

  // Keep the issue-form choice valid as branches fill up
  const issueBranch = freeStores.some((s) => s.id === branch) ? branch : freeStores[0]?.id ?? ""

  function reassign(manager: Manager, storeId: string) {
    if (isLocked(manager.id) || storeId === manager.storeId) return
    const holder = managers.find((m) => m.id !== manager.id && m.storeId === storeId)
    // TODO: persist to the real API once the backend exists
    setBranchOverride((prev) => {
      const next = { ...prev, [manager.id]: storeId }
      if (holder) next[holder.id] = manager.storeId // swap: the other manager takes this one's old branch
      return next
    })
    showToast(
      holder
        ? `Swapped — ${manager.name} → ${storeName(storeId)}, ${holder.name} → ${storeName(manager.storeId)}.`
        : `${manager.name} moved to ${storeName(storeId)}.`,
    )
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "Enter the manager's full name."
    const mail = email.trim()
    if (!mail) next.email = "Enter a Gmail address."
    else if (!/^[^\s@]+@gmail\.com$/i.test(mail))
      next.email = "That doesn't look like a valid Gmail address."
    return next
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    if (!issueBranch) return

    setSaving(true)
    // TODO: send the invite to the real API once the backend exists
    await new Promise((r) => setTimeout(r, 600))
    const mail = email.trim()
    const manager: Manager = {
      id: `local-${Date.now().toString(36)}`,
      name: name.trim(),
      username: mail.split("@")[0],
      email: mail,
      storeId: issueBranch,
      active: true,
    }
    setAdded((prev) => [manager, ...prev])
    setName("")
    setEmail("")
    setBranch("")
    setSaving(false)
    showToast(`Account issued for ${manager.name} · ${storeName(manager.storeId)}.`)
  }

  return (
    <>
      <div className="anim-rise mt-6" style={{ "--index": 0 } as CSSProperties}>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Managers</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Branch manager accounts you've issued, and the branch each one is assigned to.
        </p>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Team */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface"
          style={{ "--index": 1 } as CSSProperties}
        >
          <div className="px-5 pb-1 pt-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Team</h2>
              <p className="text-[13px] tabular-nums text-mute">
                {managers.length} {managers.length === 1 ? "account" : "accounts"}
              </p>
            </div>
            <p className="mt-0.5 text-[13px] text-mute">
              Each row is locked by default — tap the lock to reassign. Picking a branch already held
              swaps the two managers. Each manager only ever sees their assigned branch.
            </p>
          </div>
          <ul className="mt-1 divide-y divide-line">
            {managers.map((m) => (
              <ManagerRow
                key={m.id}
                manager={m}
                options={optionsFor(m)}
                locked={isLocked(m.id)}
                onToggleLock={() => toggleLock(m.id)}
                onBranchChange={(storeId) => reassign(m, storeId)}
              />
            ))}
          </ul>
        </section>

        {/* Issue an account */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface p-5 sm:p-6"
          style={{ "--index": 2 } as CSSProperties}
        >
          <h2 className="text-[15px] font-semibold text-ink">Issue an account</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            The manager signs in with this Gmail and a password you set together.
          </p>
          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="manager-name" label="Full name" error={errors.name}>
                <input
                  id="manager-name"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Juan dela Cruz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "manager-name-error" : undefined}
                  className={`${inputBase} ${errors.name ? inputBad : inputOk}`}
                />
              </FormField>
              <FormField
                id="manager-branch"
                label="Branch"
                hint={freeStores.length > 0 ? "Only branches without a manager are listed." : undefined}
              >
                {freeStores.length === 0 ? (
                  <p className="mt-2 rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[13px] text-mute">
                    Every branch already has a manager.
                  </p>
                ) : (
                  <div className="mt-2">
                    <Select
                      id="manager-branch"
                      ariaLabel="Branch for the new account"
                      value={issueBranch}
                      onChange={setBranch}
                      options={freeStores.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                )}
              </FormField>
            </div>

            <FormField id="manager-email" label="Gmail" error={errors.email}>
              <input
                id="manager-email"
                type="email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "manager-email-error" : undefined}
                className={`${inputBase} ${errors.email ? inputBad : inputOk}`}
              />
            </FormField>

            <div className="pt-1">
              <button
                type="submit"
                disabled={saving || freeStores.length === 0}
                className="flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40"
              >
                {saving ? "Issuing" : "Issue account"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <Toast key={toast?.id} message={toast?.message ?? ""} onDismiss={() => setToast(null)} />
    </>
  )
}
