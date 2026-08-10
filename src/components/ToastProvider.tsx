import { useCallback, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Toast } from "./Toast"
import { ToastContext } from "../lib/toast"
import type { ToastTone } from "../lib/toast"

export function ToastProvider({ children }: { children: ReactNode }) {
  /* Keyed by id so raising the same message twice replays the animation */
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null)

  const showToast = useCallback((message: string, tone: ToastTone = "ok") => {
    setToast({ id: Date.now(), message, tone })
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        key={toast?.id}
        message={toast?.message ?? ""}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </ToastContext.Provider>
  )
}
