import { useState } from "react"
import type { SubmitEvent } from "react"
import { ApiError, api } from "../lib/api"
import { FormField } from "./ui"
import { PasswordInput } from "./PasswordInput"
import { useToast } from "../lib/toast"

type Errors = { current?: string; next?: string; confirm?: string }

const MIN_LENGTH = 8

/*
 * The change-password card, whole: fields, eyes, character dots, validation,
 * and the save. The manager's and the owner's Account pages render this one
 * component, so the two forms can never drift apart in wording or rules.
 */
export function ChangePasswordCard() {
  const { showToast } = useToast()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const nextOk = next.length >= MIN_LENGTH
  const confirmOk = nextOk && confirm === next

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const found: Errors = {}
    if (!current) found.current = "Enter your current password."
    if (!next) found.next = "Enter a new password."
    else if (!nextOk) found.next = `Password must be at least ${MIN_LENGTH} characters.`
    if (confirm !== next) found.confirm = "Passwords do not match."
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      await api.changePassword(current, next)
      setCurrent("")
      setNext("")
      setConfirm("")
      showToast("Password updated.")
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields)
      else showToast(err instanceof ApiError ? err.message : "The password did not save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" data-rise>
      <h2 className="text-[15px] font-semibold text-ink">Change password</h2>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <FormField id="password-current" label="Current password" error={errors.current}>
          <PasswordInput
            id="password-current"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            invalid={Boolean(errors.current)}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="password-new" label="New password" error={errors.next}>
            <PasswordInput
              id="password-new"
              autoComplete="new-password"
              value={next}
              onChange={setNext}
              invalid={Boolean(errors.next)}
              dots={{
                ok: nextOk,
                label: nextOk
                  ? `${next.length} characters`
                  : `${next.length} of ${MIN_LENGTH} characters minimum`,
              }}
            />
          </FormField>
          <FormField id="password-confirm" label="Confirm new password" error={errors.confirm}>
            <PasswordInput
              id="password-confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
              invalid={Boolean(errors.confirm)}
              dots={{
                ok: confirmOk,
                label: confirmOk
                  ? "Matches the new password"
                  : `${confirm.length} ${confirm.length === 1 ? "character" : "characters"}`,
              }}
            />
          </FormField>
        </div>
        <div className="pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60"
          >
            {saving ? "Updating" : "Update password"}
          </button>
        </div>
      </form>
    </section>
  )
}
