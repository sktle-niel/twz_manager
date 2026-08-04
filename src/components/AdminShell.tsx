import { useRef } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import {
  ClockCounterClockwiseIcon,
  GearIcon,
  SignOutIcon,
  SquaresFourIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import logo from "../assets/twz-logo-light.png"
import { useRouteReveal } from "../lib/motion"
import { useSession } from "../lib/session"
import { useToast } from "../lib/toast"
import { GlobalSearch } from "./GlobalSearch"

const NAV: { to: string; label: string; icon: Icon; end?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: SquaresFourIcon, end: true },
  { to: "/admin/history", label: "History", icon: ClockCounterClockwiseIcon },
  { to: "/admin/managers", label: "Managers", icon: UsersThreeIcon },
  { to: "/admin/settings", label: "Settings", icon: GearIcon },
  { to: "/admin/account", label: "Account", icon: UserCircleIcon },
]

/* Mobile: Account lives in the top bar, the other four fill the bottom tab bar */
const MOBILE_TABS = NAV.slice(0, 4)

export default function AdminShell() {
  const { showToast } = useToast()
  const { stores } = useSession()
  const allStoreIds = stores.map((s) => s.id)
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  useRouteReveal(mainRef, pathname)

  return (
    <div className="min-h-[100dvh] lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-line bg-canvas lg:block">
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center gap-2 px-2 pt-1">
            <Link to="/admin" className="inline-flex">
              <img src={logo} alt="Two Wheels Zone" className="h-8 w-auto select-none" draggable={false} />
            </Link>
            <span className="rounded-full bg-sage px-2 py-0.5 text-[10.5px] font-medium text-sage-ink">
              Owner
            </span>
          </div>
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
              onClick={() => showToast("Signed out.")}
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
        <Link to="/admin" className="inline-flex items-center justify-self-center">
          <img src={logo} alt="Two Wheels Zone" className="h-7 w-auto select-none" draggable={false} />
        </Link>
        <NavLink
          to="/admin/account"
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

      <main
        ref={mainRef}
        className="mx-auto w-full max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-16 xl:max-w-7xl 2xl:max-w-[90rem]"
      >
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="grid h-16 grid-cols-4">
          {MOBILE_TABS.map((item) => (
            <MobileTab key={item.to} {...item} />
          ))}
        </div>
      </nav>

      {/* Every branch, plus the accounts and branches only the owner sees */}
      <GlobalSearch storeIds={allStoreIds} owner />
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
