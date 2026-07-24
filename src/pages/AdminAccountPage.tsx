import { useState } from "react"
import type { CSSProperties, SubmitEvent } from "react"
import { useNavigate } from "react-router-dom"
import { SignOutIcon } from "@phosphor-icons/react"
import { FormField, inputBad, inputBase, inputOk } from "../components/ui"

type PasswordErrors = { current?: string; next?: string; confirm?: string }

export default function AdminAccountPage() {
  const navigate = useNavigate()

  // Sample owner profile until auth exists
  const [fullName, setFullName] = useState("Two Wheels Zone")
  const [username, setUsername] = useState("twz.owner")
  const [email, setEmail] = useState("owner@gmail.com")
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({})
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  async function handleProfileSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileSaving(true)
    // TODO: send to the real API once the backend exists
    await new Promise((r) => setTimeout(r, 600))
    setProfileSaving(false)
    setProfileSaved(true)
    window.setTimeout(() => setProfileSaved(false), 3000)
  }

  async function handlePasswordSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const next: PasswordErrors = {}
    if (!currentPassword) next.current = "Enter your current password."
    if (!newPassword) next.next = "Enter a new password."
    else if (newPassword.length < 6) next.next = "Password must be at least 6 characters."
    if (confirmPassword !== newPassword) next.confirm = "Passwords do not match."
    setPasswordErrors(next)
    if (Object.keys(next).length > 0) return

    setPasswordSaving(true)
    // TODO: send to the real API once the backend exists
    await new Promise((r) => setTimeout(r, 600))
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordSaving(false)
    setPasswordSaved(true)
    window.setTimeout(() => setPasswordSaved(false), 3000)
  }

  const submitClass =
    "flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60"

  return (
    <>
      <div className="anim-rise mt-6" style={{ "--index": 0 } as CSSProperties}>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Account</h1>
        <p className="mt-0.5 text-[13px] text-mute">Your owner profile and sign-in details.</p>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Profile */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface p-5 sm:p-6"
          style={{ "--index": 1 } as CSSProperties}
        >
        <h2 className="text-[15px] font-semibold text-ink">Profile</h2>
        <form onSubmit={handleProfileSubmit} noValidate className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="owner-name" label="Full name">
              <input
                id="owner-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`${inputBase} ${inputOk}`}
              />
            </FormField>
            <FormField id="owner-username" label="Username">
              <input
                id="owner-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${inputBase} ${inputOk}`}
              />
            </FormField>
          </div>
          <FormField id="owner-email" label="Gmail">
            <input
              id="owner-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputBase} ${inputOk}`}
            />
          </FormField>
          <FormField id="owner-role" label="Role" hint="You have full access across every branch.">
            <input
              id="owner-role"
              type="text"
              value="Owner"
              disabled
              className={`${inputBase} border-line bg-canvas text-mute disabled:cursor-not-allowed`}
            />
          </FormField>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={profileSaving} className={submitClass}>
              {profileSaving ? "Saving" : "Save changes"}
            </button>
            {profileSaved && (
              <p role="status" className="text-[13px] font-medium text-sage-ink">
                Changes saved.
              </p>
            )}
          </div>
        </form>
      </section>

        {/* Password */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface p-5 sm:p-6"
          style={{ "--index": 2 } as CSSProperties}
        >
        <h2 className="text-[15px] font-semibold text-ink">Change password</h2>
        <form onSubmit={handlePasswordSubmit} noValidate className="mt-4 space-y-4">
          <FormField id="owner-password-current" label="Current password" error={passwordErrors.current}>
            <input
              id="owner-password-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              aria-invalid={Boolean(passwordErrors.current)}
              aria-describedby={passwordErrors.current ? "owner-password-current-error" : undefined}
              className={`${inputBase} ${passwordErrors.current ? inputBad : inputOk}`}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="owner-password-new" label="New password" error={passwordErrors.next}>
              <input
                id="owner-password-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-invalid={Boolean(passwordErrors.next)}
                aria-describedby={passwordErrors.next ? "owner-password-new-error" : undefined}
                className={`${inputBase} ${passwordErrors.next ? inputBad : inputOk}`}
              />
            </FormField>
            <FormField
              id="owner-password-confirm"
              label="Confirm new password"
              error={passwordErrors.confirm}
            >
              <input
                id="owner-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={Boolean(passwordErrors.confirm)}
                aria-describedby={passwordErrors.confirm ? "owner-password-confirm-error" : undefined}
                className={`${inputBase} ${passwordErrors.confirm ? inputBad : inputOk}`}
              />
            </FormField>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={passwordSaving} className={submitClass}>
              {passwordSaving ? "Updating" : "Update password"}
            </button>
            {passwordSaved && (
              <p role="status" className="text-[13px] font-medium text-sage-ink">
                Password updated.
              </p>
            )}
          </div>
        </form>
      </section>

        {/* Session */}
        <section
          className="anim-rise rounded-xl border border-line bg-surface p-5 sm:p-6"
          style={{ "--index": 3 } as CSSProperties}
        >
        <h2 className="text-[15px] font-semibold text-ink">Session</h2>
        <p className="mt-1 text-[13px] text-mute">
          Signing out returns you to the sign-in screen on this device.
        </p>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-lg border border-line-strong px-5 text-[14.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
        >
          <SignOutIcon size={17} aria-hidden="true" />
          Sign out
        </button>
        </section>
      </div>
    </>
  )
}
