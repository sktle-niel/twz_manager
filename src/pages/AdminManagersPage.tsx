import { useState } from "react"
import type { CSSProperties, SubmitEvent } from "react"
import { CaretDownIcon, StorefrontIcon } from "@phosphor-icons/react"
import { MANAGERS, STORES } from "../lib/mock"
import type { Manager } from "../lib/mock"
import { FormField, inputBad, inputBase, inputOk } from "../components/ui"

type FieldErrors = { name?: string; email?: string }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

function storeName(storeId: string): string {
  return STORES.find((s) => s.id === storeId)?.name ?? "—"
}

function ManagerRow({ manager }: { manager: Manager }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage text-[12px] font-semibold text-sage-ink">
        {initials(manager.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink-soft">{manager.name}</span>
        <span className="block truncate text-[12px] text-mute">
          {manager.username} · {storeName(manager.storeId)}
        </span>
      </span>
      {manager.active ? (
        <span className="inline-flex items-center rounded-full bg-sage px-2 py-0.5 text-[11px] font-medium text-sage-ink">
          Active
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-mute">
          Disabled
        </span>
      )}
    </li>
  )
}

export default function AdminManagersPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [branch, setBranch] = useState(STORES[0].id)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)
  const [added, setAdded] = useState<Manager[]>([])

  const managers = [...added, ...MANAGERS]

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

    setSaving(true)
    // TODO: send the invite to the real API once the backend exists
    await new Promise((r) => setTimeout(r, 600))
    const mail = email.trim()
    const manager: Manager = {
      id: `local-${Date.now().toString(36)}`,
      name: name.trim(),
      username: mail.split("@")[0],
      email: mail,
      storeId: branch,
      active: true,
    }
    setAdded((prev) => [manager, ...prev])
    setName("")
    setEmail("")
    setBranch(STORES[0].id)
    setSaving(false)
    setSavedMessage(true)
    window.setTimeout(() => setSavedMessage(false), 3000)
  }

  return (
    <>
      <div className="anim-rise mt-6" style={{ "--index": 0 } as CSSProperties}>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Managers</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Branch manager accounts you've issued for each store.
        </p>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Team */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface"
          style={{ "--index": 1 } as CSSProperties}
        >
        <div className="flex items-baseline justify-between px-5 pb-1 pt-4">
          <h2 className="text-[15px] font-semibold text-ink">Team</h2>
          <p className="text-[13px] tabular-nums text-mute">
            {managers.length} {managers.length === 1 ? "account" : "accounts"}
          </p>
        </div>
        <ul className="mt-1 divide-y divide-line">
          {managers.map((m) => (
            <ManagerRow key={m.id} manager={m} />
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
            <FormField id="manager-branch" label="Branch">
              <div className="relative">
                <select
                  id="manager-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className={`${inputBase} ${inputOk} appearance-none pr-9`}
                >
                  {STORES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <CaretDownIcon
                  size={13}
                  weight="bold"
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 mt-1 -translate-y-1/2 text-mute"
                />
              </div>
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

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60"
            >
              {saving ? "Issuing" : "Issue account"}
            </button>
            {savedMessage && (
              <p role="status" className="flex items-center gap-1.5 text-[13px] font-medium text-sage-ink">
                <StorefrontIcon size={15} weight="fill" aria-hidden="true" />
                Account issued.
              </p>
            )}
          </div>
        </form>
        </section>
      </div>
    </>
  )
}
