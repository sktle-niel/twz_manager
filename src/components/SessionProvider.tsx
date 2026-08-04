import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { api } from "../lib/api"
import type { Manager, Owner, Store } from "../lib/api"
import { SessionContext } from "../lib/session"

type Loaded = { manager: Manager; owner: Owner; stores: Store[] }

/*
 * Resolves the session and the branch list once, before any page renders.
 *
 * Doing it here rather than in each page is what let the identity move behind
 * the API without every consumer growing a loading branch: below this point
 * `manager` and `store` are always present, exactly as they were when they came
 * from a module-level constant.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [session, stores] = await Promise.all([api.session(), api.stores()])
    const manager = session.manager
    const owner = session.owner
    if (!manager || !owner || stores.length === 0) {
      throw new Error("The account could not be loaded.")
    }
    setLoaded({ manager, owner, stores })
  }, [])

  useEffect(() => {
    let live = true
    load().catch((err: unknown) => {
      if (!live) return
      setError(err instanceof Error ? err.message : "The account could not be loaded.")
    })
    return () => {
      live = false
    }
  }, [load])

  const signInAs = useCallback(
    (identifier: string) => {
      // The password is validated by the form; the backend re-checks it
      void api
        .signIn(identifier, "")
        .then(() => load())
        .catch(() => setError("Sign-in failed. Try again."))
    },
    [load],
  )

  const signOut = useCallback(() => {
    void api.signOut()
  }, [])

  const value = useMemo(
    () =>
      loaded
        ? {
            manager: loaded.manager,
            store:
              loaded.stores.find((s) => s.id === loaded.manager.storeId) ?? loaded.stores[0],
            owner: loaded.owner,
            stores: loaded.stores,
            signInAs,
            signOut,
          }
        : null,
    [loaded, signInAs, signOut],
  )

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <p className="max-w-sm text-center text-[14px] leading-[1.6] text-mute">{error}</p>
      </div>
    )
  }

  /* Held blank rather than shown as a spinner: this resolves in one round trip
     and a flash of loading chrome on every cold start reads worse than a beat
     of the page background. */
  if (!value) return <div className="min-h-[100dvh]" aria-busy="true" />

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
