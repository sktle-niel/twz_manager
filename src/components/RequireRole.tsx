import { useMemo } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { ManagerSessionContext, OwnerSessionContext, useAuth } from "../lib/session"

/*
 * The role gates in front of the two areas. Each one turns the signed-out and
 * wrong-role cases into redirects, then narrows the session for the pages
 * inside: past this point a manager page holds a real manager and their one
 * branch, an owner page holds the owner and every branch, and neither ever
 * thinks about loading or roles again.
 */

export function RequireManager() {
  const auth = useAuth()
  const manager = auth.status === "manager" ? auth.manager : null
  const store = useMemo(
    () => (manager ? (auth.stores.find((s) => s.id === manager.storeId) ?? null) : null),
    [manager, auth.stores],
  )
  const value = useMemo(
    () => (manager && store ? { manager, store } : null),
    [manager, store],
  )

  if (auth.status === "owner") return <Navigate to="/admin" replace />
  if (!manager) return <Navigate to="/login" replace />
  if (!value) {
    /* Signed in, but the account points at no branch — nothing here works
       without one, so say so instead of rendering broken pages */
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <p className="max-w-sm text-center text-[14px] leading-[1.6] text-mute">
          This account is not assigned to a branch yet. Ask the owner to assign one, then sign in
          again.
        </p>
        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="flex h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-[14.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
        >
          Sign out
        </button>
      </div>
    )
  }
  return (
    <ManagerSessionContext.Provider value={value}>
      <Outlet />
    </ManagerSessionContext.Provider>
  )
}

export function RequireOwner() {
  const auth = useAuth()
  const owner = auth.status === "owner" ? auth.owner : null
  const value = useMemo(
    () => (owner ? { owner, stores: auth.stores } : null),
    [owner, auth.stores],
  )

  if (auth.status === "manager") return <Navigate to="/" replace />
  if (!value) return <Navigate to="/login" replace />
  return (
    <OwnerSessionContext.Provider value={value}>
      <Outlet />
    </OwnerSessionContext.Provider>
  )
}
