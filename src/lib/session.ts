import { createContext, useContext } from "react"
import { MANAGERS, STORES } from "./mock"
import type { Manager, Store } from "./mock"

/*
 * The signed-in branch manager. Each account is issued for exactly one branch,
 * so the manager-facing pages read the store from here and never offer a branch
 * picker — a manager only ever sees and edits their own branch's data. The
 * owner (admin) area is the only place that spans every branch.
 *
 * There is no auth backend yet, so this is a mock identity chosen at sign-in;
 * it will be replaced by the real authenticated user.
 */
export type Session = {
  manager: Manager
  store: Store
  signInAs: (identifier: string) => void
}

export const SessionContext = createContext<Session | null>(null)

/* Match the sign-in identifier to an issued account; fall back to the first
   manager so the mock still opens when the field does not match one. */
export function resolveManager(identifier: string): Manager {
  const id = identifier.trim().toLowerCase()
  return (
    MANAGERS.find((m) => m.username.toLowerCase() === id || m.email.toLowerCase() === id) ??
    MANAGERS[0]
  )
}

export function storeForManager(manager: Manager): Store {
  return STORES.find((s) => s.id === manager.storeId) ?? STORES[0]
}

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used within a SessionProvider")
  return ctx
}
