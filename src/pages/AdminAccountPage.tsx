import { useState } from "react"
import type { SubmitEvent } from "react"
import { useNavigate } from "react-router-dom"
import { SignOutIcon } from "@phosphor-icons/react"
import { FormField, inputBad, inputBase, inputOk } from "../components/ui"
import { ChangePasswordCard } from "../components/ChangePasswordCard"
import { InstallCard } from "../components/InstallCard"
import { AvatarField } from "../components/AvatarField"
import { SignInCard } from "../components/SignInCard"
import { ApiError, api } from "../lib/api"
import type { AvatarKind } from "../lib/api"
import { useApi } from "../lib/useApi"
import { useAuth, useOwnerSession } from "../lib/session"
import { useToast } from "../lib/toast"

type ProfileErrors = { name?: string; username?: string }

export default function AdminAccountPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { owner } = useOwnerSession()
  const { applySession, signOut } = useAuth()

  const [fullName, setFullName] = useState(owner.name)
  const [username, setUsername] = useState(owner.username)
  /* Optional: with none attached the chosen stock avatar stands in (girl by default) */
  const [avatarKind, setAvatarKind] = useState<AvatarKind>(owner.avatarKind ?? "girl")
  const [photo, setPhoto] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [profileSaving, setProfileSaving] = useState(false)

  /* Frozen at mount so the sign-in log's relative times hold still between renders */
  const [now] = useState(() => new Date())
  const signIns = useApi(() => api.signIns(owner.id), [owner.id])

  async function handleProfileSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileErrors({})
    try {
      const session = await api.updateProfile({
        name: fullName,
        username,
        avatarKind,
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
        <p className="mt-0.5 text-[13px] text-mute">Your owner profile and sign-in details.</p>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        {/* Profile */}
        <section
          className="rounded-xl border border-line bg-surface p-5 sm:p-6"
          data-rise
        >
        <h2 className="text-[15px] font-semibold text-ink">Profile</h2>
        <form onSubmit={handleProfileSubmit} noValidate className="mt-4 space-y-4">
          <AvatarField
            id="owner-photo"
            name={fullName}
            avatarKind={avatarKind}
            onAvatarKind={setAvatarKind}
            file={photo}
            existingUrl={removePhoto ? null : owner.photoUrl}
            onChange={setPhoto}
            onRemoveExisting={() => setRemovePhoto(true)}
            hint="Pick a standard avatar, or attach your own photo."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="owner-name" label="Full name" error={profileErrors.name}>
              <input
                id="owner-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(profileErrors.name)}
                aria-describedby={profileErrors.name ? "owner-name-error" : undefined}
                className={`${inputBase} ${profileErrors.name ? inputBad : inputOk}`}
              />
            </FormField>
            <FormField id="owner-username" label="Username" error={profileErrors.username}>
              <input
                id="owner-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={Boolean(profileErrors.username)}
                aria-describedby={profileErrors.username ? "owner-username-error" : undefined}
                className={`${inputBase} ${profileErrors.username ? inputBad : inputOk}`}
              />
            </FormField>
          </div>
          <FormField id="owner-role" label="Role" hint="You have full access across every branch.">
            <input
              id="owner-role"
              type="text"
              value="Owner"
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

        <ChangePasswordCard />

        {/* Renders only in a browser tab — inside the installed app it's moot */}
        <InstallCard />

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
