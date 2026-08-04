import { createContext, useContext } from "react"
import type { Session } from "./api"
import type { Manager, Owner, Store } from "./api"

/*
 * Identity, in two layers.
 *
 * `useAuth` is the whole truth: whether anyone is signed in, who, and the
 * verbs (sign in, sign out). Only the login page and the route guards read it,
 * because only they have to think about the signed-out case.
 *
 * Inside a guarded area the question is already answered, so pages read a
 * narrowed context instead: `useManagerSession` hands the manager pages a
 * non-null manager and their one branch, `useOwnerSession` hands the owner
 * pages the owner and every branch. The guards provide these, which is what
 * keeps a loading/role branch out of every single page.
 */

export type AuthStatus = "loading" | "signed-out" | "manager" | "owner"

export type Auth = {
  status: AuthStatus
  manager: Manager | null
  owner: Owner | null
  /** Every branch; empty until a session is established */
  stores: Store[]
  /** Resolves on success, rejects with ApiError for the form to show */
  signIn: (identifier: string, password: string, remember: boolean) => Promise<Session>
  /** Ends the server session and drops to signed-out */
  signOut: () => Promise<void>
  /** Adopt a session the API just returned, e.g. after a profile update */
  applySession: (session: Session) => void
}

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within a SessionProvider")
  return ctx
}

/** What every manager-side page runs on. Provided by the manager route guard. */
export type ManagerSession = {
  manager: Manager
  /** The one branch this account is issued for */
  store: Store
}

export const ManagerSessionContext = createContext<ManagerSession | null>(null)

export function useManagerSession(): ManagerSession {
  const ctx = useContext(ManagerSessionContext)
  if (!ctx) throw new Error("useManagerSession must be used inside the manager area")
  return ctx
}

/** What every owner-side page runs on. Provided by the owner route guard. */
export type OwnerSession = {
  owner: Owner
  /** Every branch, for the owner area */
  stores: Store[]
}

export const OwnerSessionContext = createContext<OwnerSession | null>(null)

export function useOwnerSession(): OwnerSession {
  const ctx = useContext(OwnerSessionContext)
  if (!ctx) throw new Error("useOwnerSession must be used inside the owner area")
  return ctx
}
