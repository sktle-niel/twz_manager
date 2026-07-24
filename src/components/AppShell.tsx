import { useEffect, useState } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  BankIcon,
  ClockCounterClockwiseIcon,
  PlusIcon,
  ReceiptIcon,
  SignOutIcon,
  SquaresFourIcon,
  UserCircleIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import logo from "../assets/twz-logo-light.png"

const NAV: { to: string; label: string; icon: Icon; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: SquaresFourIcon, end: true },
  { to: "/expenses", label: "Expenses", icon: ReceiptIcon },
  { to: "/deposits", label: "Deposits", icon: BankIcon },
  { to: "/history", label: "History", icon: ClockCounterClockwiseIcon },
  { to: "/account", label: "Account", icon: UserCircleIcon },
]

/* Mobile: Account lives in the top bar, the other four flank the center button */
const MOBILE_TABS = NAV.slice(0, 4)

function NewEntrySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  return (
    <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="New entry">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="anim-fade absolute inset-0 bg-ink/25"
      />
      <div className="anim-sheet absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
        <div aria-hidden="true" className="mx-auto h-1 w-9 rounded-full bg-line" />
        <p className="mt-3 px-3 text-[13px] font-medium text-mute">New entry</p>
        <div className="mt-1 space-y-1">
          <button
            type="button"
            autoFocus
            onClick={() => go("/expenses")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-200 ease-quiet hover:bg-black/[0.04]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage text-sage-ink">
              <ReceiptIcon size={19} weight="bold" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[14.5px] font-medium text-ink">Log expense</span>
              <span className="block text-[12.5px] text-mute">Meals, merienda, and other costs</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => go("/deposits")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-200 ease-quiet hover:bg-black/[0.04]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage text-sage-ink">
              <BankIcon size={19} weight="bold" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[14.5px] font-medium text-ink">Record deposit</span>
              <span className="block text-[12.5px] text-mute">Attach the bank deposit slip</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AppShell() {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-line bg-canvas lg:block">
        <div className="flex h-full flex-col p-4">
          <Link to="/" className="px-2 pt-1">
            <img src={logo} alt="Two Wheels Zone" className="h-8 w-auto select-none" draggable={false} />
          </Link>
          <nav aria-label="Primary" className="mt-8 space-y-1">
            {NAV.map(({ to, label, icon: NavIcon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors duration-200 ease-quiet ${
                    isActive
                      ? "bg-sage text-sage-ink"
                      : "text-ink-soft hover:bg-black/[0.04] hover:text-ink"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <NavIcon size={18} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto border-t border-line pt-3">
            <Link
              to="/login"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
            >
              <SignOutIcon size={18} aria-hidden="true" />
              <span>Sign out</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile top bar: centered logo, account on the right */}
      <header className="grid h-14 grid-cols-[44px_1fr_44px] items-center border-b border-line bg-canvas px-2 lg:hidden">
        <span aria-hidden="true" />
        <Link to="/" className="inline-flex items-center justify-self-center">
          <img src={logo} alt="Two Wheels Zone" className="h-7 w-auto select-none" draggable={false} />
        </Link>
        <NavLink
          to="/account"
          aria-label="Account"
          className={({ isActive }) =>
            `flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-200 ease-quiet ${
              isActive ? "text-brand-deep" : "text-ink-soft"
            }`
          }
        >
          {({ isActive }) => (
            <UserCircleIcon size={24} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
          )}
        </NavLink>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-16">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="grid h-16 grid-cols-5">
          {MOBILE_TABS.slice(0, 2).map((item) => (
            <MobileTab key={item.to} {...item} />
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="New entry"
              aria-haspopup="dialog"
              className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-5 items-center justify-center rounded-full bg-ink text-white shadow-[0_2px_10px_rgba(21,22,19,0.14)] ring-4 ring-canvas transition-transform duration-200 ease-quiet active:scale-95"
            >
              <PlusIcon size={26} weight="bold" aria-hidden="true" />
            </button>
          </div>
          {MOBILE_TABS.slice(2).map((item) => (
            <MobileTab key={item.to} {...item} />
          ))}
        </div>
      </nav>

      <NewEntrySheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}

function MobileTab({ to, label, icon: TabIcon, end }: { to: string; label: string; icon: Icon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors duration-200 ease-quiet ${
          isActive ? "text-brand-deep" : "text-mute"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <TabIcon size={22} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}
