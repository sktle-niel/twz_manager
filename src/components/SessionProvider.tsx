import { useState } from "react"
import type { ReactNode } from "react"
import { MANAGERS } from "../lib/mock"
import type { Manager } from "../lib/mock"
import { SessionContext, resolveManager, storeForManager } from "../lib/session"

export function SessionProvider({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState<Manager>(MANAGERS[0])

  const value = {
    manager,
    store: storeForManager(manager),
    signInAs: (identifier: string) => setManager(resolveManager(identifier)),
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
