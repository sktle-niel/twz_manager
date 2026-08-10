import { useState } from "react"
import type { SubmitEvent } from "react"
import { KeyIcon, LockIcon, LockOpenIcon, StorefrontIcon } from "@phosphor-icons/react"
import { ApiError, api } from "../lib/api"
import type { Manager } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useOwnerSession } from "../lib/session"
import { stockAvatar } from "../lib/avatar"
import { FilterSelect, FormField, inputBad, inputBase, inputOk } from "../components/ui"
import { Select } from "../components/Select"
import type { SelectOption } from "../components/Select"
import { useToast } from "../lib/toast"

type FieldErrors = { name?: string; username?: string; password?: string }
type ResetErrors = { pin?: string; password?: string; confirm?: string; form?: string }

function ManagerRow({
  manager,
  options,
  locked,
  resetting,
  onToggleLock,
  onBranchChange,
  onToggleReset,
}: {
  manager: Manager
  /* Every branch: their own, the free ones, and occupied ones (which swap) */
  options: SelectOption[]
  locked: boolean
  resetting: boolean
  onToggleLock: () => void
  onBranchChange: (storeId: string) => void
  onToggleReset: () => void
}) {
  return (
    /*
     * Two lines on a phone, one on wider screens. The name owns the first
     * line in full; the branch select and the two actions wrap onto their
     * own row (`w-full` forces the break) instead of squeezing the name down
     * to a sliver beside a fixed-width select.
     */
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <img
        src={manager.photoUrl ?? stockAvatar(manager.avatarKind)}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-line"
        draggable={false}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink-soft">{manager.name}</span>
          {!manager.active && (
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-mute">
              Disabled
            </span>
          )}
        </span>
        {/* The username is the credential now, so it is what the row shows */}
        <span className="block truncate text-[12px] text-mute">{manager.username}</span>
      </span>
      <div className="flex w-full items-center gap-2 pl-12 sm:w-auto sm:pl-0">
        <FilterSelect
          ariaLabel={`Branch for ${manager.name}`}
          icon={<StorefrontIcon size={15} weight="bold" aria-hidden="true" />}
          value={manager.storeId}
          onChange={onBranchChange}
          options={options}
          disabled={locked}
          className="min-w-0 flex-1 sm:w-44 sm:flex-none"
        />
        <button
          type="button"
          onClick={onToggleReset}
          aria-pressed={resetting}
          aria-label={`Set a new password for ${manager.name}`}
          title="Set a new password"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ease-quiet hover:bg-black/[0.04] ${
            resetting ? "text-brand-deep" : "text-mute hover:text-ink"
          }`}
        >
          <KeyIcon size={16} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggleLock}
          aria-pressed={locked}
          aria-label={
            locked ? `Unlock branch for ${manager.name}` : `Lock branch for ${manager.name}`
          }
          title={locked ? "Locked. Click to allow changes" : "Unlocked. Click to lock"}
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
      </div>
    </div>
  )
}

/*
 * Recovery, in the only shape left once accounts have no email: the manager
 * asks the owner in person, and the owner types a new password here. The PIN
 * is the second lock — being signed in as the owner is not enough, so an
 * unattended laptop cannot be used to take a branch account.
 */
function ResetPanel({
  manager,
  onDone,
}: {
  manager: Manager
  onDone: (password: string) => void
}) {
  const [pin, setPin] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<ResetErrors>({})
  const [saving, setSaving] = useState(false)

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const next: ResetErrors = {}
    if (!pin.trim()) next.pin = "Enter the recovery PIN."
    if (!password) next.password = "Choose a new password."
    else if (password.length < 8) next.password = "Password must be at least 8 characters."
    if (confirm !== password) next.confirm = "These two do not match."
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      await api.setManagerPassword(manager.id, pin.trim(), password)
      onDone(password)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? { form: err.message })
      } else {
        setErrors({ form: "That did not go through. Try again." })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="border-t border-line bg-canvas px-5 py-4">
      <p className="text-[13px] text-mute">
        Set a new password for <span className="font-medium text-ink-soft">{manager.name}</span>.
        Their old one is not needed. Hand the new one over in person.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FormField id={`pin-${manager.id}`} label="Recovery PIN" error={errors.pin}>
          <input
            id={`pin-${manager.id}`}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            placeholder="4 digits"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            aria-invalid={Boolean(errors.pin)}
            className={`${inputBase} ${errors.pin ? inputBad : inputOk}`}
          />
        </FormField>
        <FormField id={`pw-${manager.id}`} label="New password" error={errors.password}>
          <input
            id={`pw-${manager.id}`}
            type="text"
            autoComplete="off"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            className={`${inputBase} ${errors.password ? inputBad : inputOk}`}
          />
        </FormField>
        <FormField id={`pw2-${manager.id}`} label="Type it again" error={errors.confirm}>
          <input
            id={`pw2-${manager.id}`}
            type="text"
            autoComplete="off"
            placeholder="The same password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(errors.confirm)}
            className={`${inputBase} ${errors.confirm ? inputBad : inputOk}`}
          />
        </FormField>
      </div>
      {errors.form && (
        <p role="alert" className="mt-2 text-[13px] text-claret">
          {errors.form}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="mt-3 flex h-11 items-center justify-center rounded-lg bg-ink px-5 text-[14.5px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40"
      >
        {saving ? "Setting" : "Set password"}
      </button>
    </form>
  )
}

export default function AdminManagersPage() {
  const { showToast } = useToast()
  const { stores } = useOwnerSession()
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [branch, setBranch] = useState(stores[0].id)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  // Locked by default so a stray click never moves a manager; the admin
  // unlocks a row deliberately before reassigning it
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [resettingId, setResettingId] = useState<string | null>(null)

  const isLocked = (id: string) => locked[id] ?? true
  const toggleLock = (id: string) => setLocked((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))

  /* The list is the server's now: reassignment used to be an override layer
     held here, which meant a swap only existed on this page */
  const loaded = useApi(() => api.managers(), [])
  const managers = loaded.data ?? []

  // One branch per manager: a branch is taken by whoever currently holds it
  const takenBy: Record<string, string> = {}
  for (const m of managers) takenBy[m.storeId] = m.id
  const freeStores = stores.filter((s) => !takenBy[s.id])
  const storeName = (storeId: string) => stores.find((s) => s.id === storeId)?.name ?? storeId

  // Every branch is offered for reassignment: the manager's own, the free ones,
  // and those held by someone else — picking an occupied branch swaps the two,
  // which is how a wrong assignment gets corrected without ever doubling up.
  const optionsFor = (m: Manager): SelectOption[] =>
    stores.flatMap((s) => {
      const holder = managers.find((x) => x.id !== m.id && x.storeId === s.id)
      // A locked manager can't be swapped out, so drop their branch as a target
      if (holder && isLocked(holder.id)) return []
      return [{ value: s.id, label: s.name, hint: holder ? `Held by ${holder.name} · swaps` : undefined }]
    })

  // Keep the issue-form choice valid as branches fill up
  const issueBranch = freeStores.some((s) => s.id === branch) ? branch : freeStores[0]?.id ?? ""

  async function reassign(manager: Manager, storeId: string) {
    if (isLocked(manager.id) || storeId === manager.storeId) return
    const holder = managers.find((m) => m.id !== manager.id && m.storeId === storeId)
    try {
      // The swap is the server's to make — it owns the one-branch-one-manager rule
      await api.assignBranch(manager.id, storeId)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "The reassignment did not go through.")
      return
    }
    loaded.reload()
    showToast(
      holder
        ? `Swapped: ${manager.name} → ${storeName(storeId)}, ${holder.name} → ${storeName(manager.storeId)}.`
        : `${manager.name} moved to ${storeName(storeId)}.`,
    )
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = "Enter the manager's full name."
    const handle = username.trim().toLowerCase()
    if (!handle) next.username = "Enter a username."
    else if (!/^[a-z0-9._-]+$/.test(handle))
      next.username = "Letters, numbers, dots, dashes and underscores only."
    if (!password) next.password = "Set a first password."
    else if (password.length < 8) next.password = "Password must be at least 8 characters."
    return next
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    if (!issueBranch) return

    setSaving(true)
    try {
      const manager = await api.issueManager({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        storeId: issueBranch,
        password,
      })
      loaded.reload()
      setName("")
      setUsername("")
      setPassword("")
      setBranch("")
      showToast(`Account issued for ${manager.name} · ${storeName(manager.storeId)}.`)
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields)
      showToast(err instanceof ApiError ? err.message : "The account could not be issued.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-6" data-rise>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Managers</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Branch manager accounts you've issued, and the branch each one is assigned to.
        </p>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Team */}
        <section className="rounded-xl border border-line bg-surface" data-rise>
          <div className="px-5 pb-1 pt-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Team</h2>
              <p className="text-[13px] tabular-nums text-mute">
                {managers.length} {managers.length === 1 ? "account" : "accounts"}
              </p>
            </div>
            <p className="mt-0.5 text-[13px] text-mute">
              Each row is locked by default. Tap the lock to reassign. Picking a branch already held
              swaps the two managers. The key sets a new password for a manager who is locked out.
            </p>
          </div>
          {loaded.error ? (
            <p role="alert" className="flex flex-wrap items-center gap-2 px-5 py-6 text-[13px] text-claret">
              The accounts could not load.
              <button
                type="button"
                onClick={loaded.reload}
                className="font-medium underline underline-offset-4"
              >
                Try again
              </button>
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {managers.map((m) => (
                <li key={m.id}>
                  <ManagerRow
                    manager={m}
                    options={optionsFor(m)}
                    locked={isLocked(m.id)}
                    resetting={resettingId === m.id}
                    onToggleLock={() => toggleLock(m.id)}
                    onBranchChange={(storeId) => void reassign(m, storeId)}
                    onToggleReset={() => setResettingId(resettingId === m.id ? null : m.id)}
                  />
                  {resettingId === m.id && (
                    <ResetPanel
                      manager={m}
                      onDone={() => {
                        setResettingId(null)
                        showToast(`New password set for ${m.name}. Tell them in person.`)
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Issue an account */}
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" data-rise>
          <h2 className="text-[15px] font-semibold text-ink">Issue an account</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            The manager signs in with this username and password. There is no email anywhere in the
            system, so hand both over in person.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="manager-username" label="Username" error={errors.username}>
                <input
                  id="manager-username"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="firstname.lastname"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? "manager-username-error" : undefined}
                  className={`${inputBase} ${errors.username ? inputBad : inputOk}`}
                />
              </FormField>
              <FormField id="manager-password" label="First password" error={errors.password}>
                <input
                  id="manager-password"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "manager-password-error" : undefined}
                  className={`${inputBase} ${errors.password ? inputBad : inputOk}`}
                />
              </FormField>
            </div>

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
    </>
  )
}
