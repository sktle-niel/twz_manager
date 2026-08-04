import { createContext, useContext } from "react"
import type { Manager, Owner, Store } from "./api"

/*
 * The signed-in identity. Each manager account is issued for exactly one
 * branch, so the manager-facing pages read the store from here and never offer
 * a branch picker — a manager only ever sees their own branch's data, and the
 * owner area is the only place that spans every one.
 *
 * The provider resolves this before rendering any page, so consumers still get
 * a non-null `manager` and `store` and none of them had to learn about loading
 * states when the data moved behind the API.
 */
export type Session = {
  manager: Manager
  store: Store
  owner: Owner
  /** Every branch, for the owner area */
  stores: Store[]
  signInAs: (identifier: string) => void
  signOut: () => void
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used within a SessionProvider")
  return ctx
}
