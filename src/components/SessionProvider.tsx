import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { api, onUnauthorized } from "../lib/api"
import type { Session, Store } from "../lib/api"
import { AuthContext } from "../lib/session"
import type { AuthStatus } from "../lib/session"
import { clearApiCache } from "../lib/useApi"

type State =
  | { status: "loading" | "signed-out" }
  | { status: "manager" | "owner"; session: Session; stores: Store[] }

/*
 * Resolves who is signed in once, before any route renders, and owns every
 * transition after that: sign-in, sign-out, and a session expiring under us.
 *
 * A session is one identity or none — `GET /session` answering with neither is
 * the normal signed-out case, not a failure, and the route guards turn it into
 * a redirect to /login. Only a transport failure blocks the boot, and that
 * renders a retry rather than a dead end: the branch's connection dropping for
 * a moment must not strand the manager on an error screen.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" })
  const [bootError, setBootError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)

  const adopt = useCallback(async (session: Session): Promise<State> => {
    if (!session.manager && !session.owner) return { status: "signed-out" }
    const stores = await api.stores()
    return { status: session.manager ? "manager" : "owner", session, stores }
  }, [])

  useEffect(() => {
    let live = true
    setBootError(null)
    api
      .session()
      .then(adopt)
      .then((next) => {
        if (live) setState(next)
      })
      .catch((err: unknown) => {
        if (!live) return
        setBootError(err instanceof Error ? err.message : "The app could not load. Try again.")
      })
    return () => {
      live = false
    }
  }, [adopt, retryNonce])

  /* A 401 from any request means the cookie died under us — drop to signed-out
     and let the guards walk the user back to the sign-in form. Sign-in's own
     401 (wrong password) also fires this, harmlessly: the state it resets to
     is the state a failed sign-in is already in. */
  useEffect(() => {
    return onUnauthorized(() => {
      clearApiCache()
      setState((prev) => (prev.status === "manager" || prev.status === "owner" ? { status: "signed-out" } : prev))
    })
  }, [])

  const signIn = useCallback(
    async (identifier: string, password: string, remember: boolean) => {
      // A different identity must never be served the previous one's reads
      clearApiCache()
      const session = await api.signIn(identifier, password, remember)
      setState(await adopt(session))
      return session
    },
    [adopt],
  )

  const signOut = useCallback(async () => {
    try {
      await api.signOut()
    } finally {
      /* The UI signs out even if the DELETE was lost to the network — showing
         a signed-in shell after the user asked to leave is the worse failure */
      clearApiCache()
      setState({ status: "signed-out" })
    }
  }, [])

  const applySession = useCallback((session: Session) => {
    setState((prev) => {
      if (prev.status !== "manager" && prev.status !== "owner") return prev
      if (!session.manager && !session.owner) return { status: "signed-out" }
      return { ...prev, status: session.manager ? "manager" : "owner", session }
    })
  }, [])

  const value = useMemo(() => {
    const status: AuthStatus = state.status
    const session = state.status === "manager" || state.status === "owner" ? state.session : null
    return {
      status,
      manager: session?.manager ?? null,
      owner: session?.owner ?? null,
      stores: state.status === "manager" || state.status === "owner" ? state.stores : [],
      signIn,
      signOut,
      applySession,
    }
  }, [state, signIn, signOut, applySession])

  if (bootError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <p className="max-w-sm text-center text-[14px] leading-[1.6] text-mute">{bootError}</p>
        <button
          type="button"
          onClick={() => setRetryNonce((n) => n + 1)}
          className="flex h-11 items-center justify-center rounded-lg border border-line-strong px-5 text-[14.5px] font-medium text-ink transition-colors duration-200 ease-quiet hover:bg-black/[0.03]"
        >
          Try again
        </button>
      </div>
    )
  }

  /* Held blank rather than shown as a spinner: this resolves in one round trip
     and a flash of loading chrome on every cold start reads worse than a beat
     of the page background. */
  if (state.status === "loading") return <div className="min-h-[100dvh]" aria-busy="true" />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
