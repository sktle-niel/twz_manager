import { useLayoutEffect } from "react"
import { useLocation } from "react-router-dom"

/*
 * A client-side navigation swaps the page's content but leaves the window
 * scrolled where it was, so opening the dashboard from halfway down the
 * expenses list dropped you halfway down the dashboard. Reset it per route.
 *
 * useLayoutEffect rather than useEffect: it runs before the browser paints, so
 * the new page is never briefly shown at the old offset. It also lands ahead of
 * useRouteReveal's entry tween, which then plays on a page already at the top.
 *
 * Keyed on pathname alone — a query change is a filter, not a new page, and
 * should leave the reader where they are.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}
