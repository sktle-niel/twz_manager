import { useState } from "react"
import type { SubmitEvent } from "react"
import { useNavigate } from "react-router-dom"
import { SignOutIcon } from "@phosphor-icons/react"
import { FormField, inputBad, inputBase, inputOk } from "../components/ui"
import { AvatarField } from "../components/AvatarField"
import { SignInCard } from "../components/SignInCard"
import { ApiError, api } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useAuth, useManagerSession } from "../lib/session"
import { useToast } from "../lib/toast"

type ProfileErrors = { name?: string; username?: string; email?: string }
type PasswordErrors = { current?: string; next?: string; confirm?: string }

export default function AccountPage() {
  const navigate = useNavigate()
  const { manager, store } = useManagerSession()
  const { applySession, signOut } = useAuth()
  const { showToast } = useToast()

  const [fullName, setFullName] = useState(manager.name)
  const [username, setUsername] = useState(manager.username)
  const [email, setEmail] = useState(manager.email)
  /* Optional: with none attached the avatar falls back to the account's initials */
  const [photo, setPhoto] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [profileSaving, setProfileSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({})
  const [passwordSaving, setPasswordSaving] = useState(false)

  /* Frozen at mount so the sign-in log's relative times hold still between renders */
  const [now] = useState(() => new Date())
  const signIns = useApi(() => api.signIns(manager.id), [manager.id])

  async function handleProfileSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileErrors({})
    try {
      const session = await api.updateProfile({
        name: fullName,
        username,
        email,
        ...(photo ? { photo } : {}),
        ...(removePhoto && !photo ? { removePhoto: true } : {}),
      })
      applySession(session)
      setPhoto(null)
      setRemovePhoto(false)
      showToast("Profile saved.")
    } catch (err) {
      if (err instanceof ApiError && err.fields) setProfileErrors(err.fields)
      else showToast(err instanceof ApiError ? err.message : "That did not save. Try again.")
    } finally {
      setProfileSaving(false)
    }
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
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      showToast("Password updated.")
    } catch (err) {
      if (err instanceof ApiError && err.fields) setPasswordErrors(err.fields)
      else showToast(err instanceof ApiError ? err.message : "That did not save. Try again.")
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate("/login", { replace: true })
    showToast("Signed out.")
  }

  const submitClass =
    "flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 ease-quiet hover:bg-[#2e2f2b] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60"

  return (
    <>
      <div className="mt-6" data-rise>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">Account</h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Your profile and sign-in details for this branch.
        </p>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        {/* Profile */}
        <section
          className="rounded-xl border border-line bg-surface p-5 sm:p-6"
          data-rise
        >
        <h2 className="text-[15px] font-semibold text-ink">Profile</h2>
        <form onSubmit={handleProfileSubmit} noValidate className="mt-4 space-y-4">
          <AvatarField
            id="account-photo"
            name={fullName}
            file={photo}
            existingUrl={removePhoto ? null : manager.photoUrl}
            onChange={setPhoto}
            onRemoveExisting={() => setRemovePhoto(true)}
            hint="Optional — your initials stand in without one."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="account-name" label="Full name" error={profileErrors.name}>
              <input
                id="account-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(profileErrors.name)}
                aria-describedby={profileErrors.name ? "account-name-error" : undefined}
                className={`${inputBase} ${profileErrors.name ? inputBad : inputOk}`}
              />
            </FormField>
            <FormField id="account-username" label="Username" error={profileErrors.username}>
              <input
                id="account-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={Boolean(profileErrors.username)}
                aria-describedby={profileErrors.username ? "account-username-error" : undefined}
                className={`${inputBase} ${profileErrors.username ? inputBad : inputOk}`}
              />
            </FormField>
          </div>
          <FormField id="account-email" label="Gmail" error={profileErrors.email}>
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(profileErrors.email)}
              aria-describedby={profileErrors.email ? "account-email-error" : undefined}
              className={`${inputBase} ${profileErrors.email ? inputBad : inputOk}`}
            />
          </FormField>
          <FormField
            id="account-branch"
            label="Branch"
            hint="Branch assignment is managed by the owner."
          >
            <input
              id="account-branch"
              type="text"
              value={store.name}
              disabled
              className={`${inputBase} border-line bg-canvas text-mute disabled:cursor-not-allowed`}
            />
          </FormField>
          <div className="pt-1">
            <button type="submit" disabled={profileSaving} className={submitClass}>
              {profileSaving ? "Saving" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

        {/* Password */}
        <section
          className="rounded-xl border border-line bg-surface p-5 sm:p-6"
          data-rise
        >
        <h2 className="text-[15px] font-semibold text-ink">Change password</h2>
        <form onSubmit={handlePasswordSubmit} noValidate className="mt-4 space-y-4">
          <FormField id="password-current" label="Current password" error={passwordErrors.current}>
            <input
              id="password-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              aria-invalid={Boolean(passwordErrors.current)}
              aria-describedby={passwordErrors.current ? "password-current-error" : undefined}
              className={`${inputBase} ${passwordErrors.current ? inputBad : inputOk}`}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="password-new" label="New password" error={passwordErrors.next}>
              <input
                id="password-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-invalid={Boolean(passwordErrors.next)}
                aria-describedby={passwordErrors.next ? "password-new-error" : undefined}
                className={`${inputBase} ${passwordErrors.next ? inputBad : inputOk}`}
              />
            </FormField>
            <FormField
              id="password-confirm"
              label="Confirm new password"
              error={passwordErrors.confirm}
            >
              <input
                id="password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={Boolean(passwordErrors.confirm)}
                aria-describedby={passwordErrors.confirm ? "password-confirm-error" : undefined}
                className={`${inputBase} ${passwordErrors.confirm ? inputBad : inputOk}`}
              />
            </FormField>
          </div>
          <div className="pt-1">
            <button type="submit" disabled={passwordSaving} className={submitClass}>
              {passwordSaving ? "Updating" : "Update password"}
            </button>
          </div>
        </form>
      </section>

        {/* Session */}
        <section
          className="rounded-xl border border-line bg-surface p-5 sm:p-6"
          data-rise
        >
        <h2 className="text-[15px] font-semibold text-ink">Session</h2>
        <p className="mt-1 text-[13px] text-mute">
          Signing out returns you to the sign-in screen on this device. Any other device stays
          signed in.
        </p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-lg border border-line-strong px-5 text-[14.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
        >
          <SignOutIcon size={17} aria-hidden="true" />
          Sign out
        </button>
        </section>

        {/* Pairs with Session on the second row of the 2×2 grid */}
        <SignInCard events={signIns.data ?? []} now={now} loading={signIns.loading} />
      </div>
    </>
  )
}
