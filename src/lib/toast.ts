import { createContext, useContext } from "react"

/*
 * One toast host for the whole app. Pages used to each hold their own toast
 * state, or an inline "Saved." line beside the button, which meant every new
 * action had to reinvent its own confirmation. Now any page raises a message
 * through useToast() and the provider owns the single portalled Toast.
 */
export type ToastApi = { showToast: (message: string) => void }

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within a ToastProvider")
  return ctx
}
