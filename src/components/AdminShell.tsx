import { useRef } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  ClockCounterClockwiseIcon,
  FunnelIcon,
  GearIcon,
  SignOutIcon,
  SquaresFourIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import logo from "../assets/twz-logo-light.png"
import crew from "../assets/twz-crew.webp"
import { stockAvatar } from "../lib/avatar"
import { useRouteReveal } from "../lib/motion"
import { useAuth, useOwnerSession } from "../lib/session"
import { useToast } from "../lib/toast"
import { GlobalSearch } from "./GlobalSearch"

const NAV: { to: string; label: string; icon: Icon; end?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: SquaresFourIcon, end: true },
  { to: "/admin/history", label: "History", icon: ClockCounterClockwiseIcon },
  { to: "/admin/managers", label: "Managers", icon: UsersThreeIcon },
  { to: "/admin/sales-filter", label: "Sales filter", icon: FunnelIcon },
  { to: "/admin/settings", label: "Settings", icon: GearIcon },
  { to: "/admin/account", label: "Account", icon: UserCircleIcon },
]

/* Mobile: Account lives in the top bar, the other five fill the bottom tab bar */
const MOBILE_TABS = NAV.slice(0, 5)

export default function AdminShell() {
  const { showToast } = useToast()
  const { owner, stores } = useOwnerSession()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const avatar = owner.photoUrl ?? stockAvatar(owner.avatarKind)
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  useRouteReveal(mainRef, pathname)

  async function handleSignOut() {
    await signOut()
    navigate("/login", { replace: true })
    showToast("Signed out.")
  }

  return (
    <div className="min-h-[100dvh] lg:pl-60">
      {/* The crew, faint on the canvas behind every page. Cards and tables sit
          on opaque surfaces, so the art only shows in the breathing room and
          never under a figure someone has to read. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <img
          src={crew}
          alt=""
          draggable={false}
          className="absolute bottom-0 right-0 h-[40vh] w-auto opacity-[0.06] select-none lg:h-[min(62vh,560px)]"
        />
      </div>

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
            {/* Whose session this is, wherever in the app they are */}
            <Link
              to="/admin/account"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors duration-200 ease-quiet hover:bg-black/[0.04]"
            >
              <img
                src={avatar}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-line"
                draggable={false}
              />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {owner.name}
                </span>
                <span className="block truncate text-[11.5px] text-mute">Owner</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors duration-200 ease-quiet hover:bg-black/[0.04] hover:text-ink"
            >
              <SignOutIcon size={18} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar: centered logo, the account's own face on the right */}
      <header className="grid h-14 grid-cols-[44px_1fr_44px] items-center border-b border-line bg-canvas px-2 lg:hidden">
        <span aria-hidden="true" />
        <Link to="/admin" className="inline-flex items-center justify-self-center">
          <img src={logo} alt="Two Wheels Zone" className="h-7 w-auto select-none" draggable={false} />
        </Link>
        <NavLink
          to="/admin/account"
          aria-label="Account"
          className="flex h-11 w-11 items-center justify-center"
        >
          {({ isActive }) => (
            <img
              src={avatar}
              alt=""
              draggable={false}
              className={`h-8 w-8 rounded-full object-cover transition-shadow duration-200 ease-quiet ${
                isActive ? "ring-2 ring-brand-deep" : "ring-1 ring-line"
              }`}
            />
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
        {/* Columns follow the tab count — a hardcoded grid-cols-4 once left a
            fifth tab wrapping onto a second row */}
        <div
          className="grid h-16"
          style={{ gridTemplateColumns: `repeat(${MOBILE_TABS.length}, minmax(0, 1fr))` }}
        >
          {MOBILE_TABS.map((item) => (
            <MobileTab key={item.to} {...item} />
          ))}
        </div>
      </nav>

      {/* Every branch, plus the accounts and branches only the owner sees */}
      <GlobalSearch stores={stores} owner />
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
