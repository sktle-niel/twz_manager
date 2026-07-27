import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import type { RefObject } from "react"

gsap.registerPlugin(useGSAP)

/*
 * The app's motion vocabulary, in one place. Everything here animates only
 * transform and opacity so the work stays on the compositor; hover and focus
 * states are left to CSS transitions, which do the same job for less.
 *
 * "expo.out" is GSAP's name for cubic-bezier(0.16, 1, 0.3, 1) — the same
 * --ease-quiet those CSS transitions use, so a tween and a hover state on one
 * element read as a single system.
 */
export const EASE = "expo.out"

export const DUR = {
  rise: 0.6,
  sheet: 0.24,
  fade: 0.2,
  toast: 0.26,
  ring: 0.24,
  tick: 0.34,
  pop: 0.14,
} as const

export const STAGGER = 0.08

/*
 * Reduced motion drops the tween rather than shortening it. Every animation in
 * the app is a one-shot entrance, so skipping it simply leaves the element
 * where the layout already put it.
 */
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/*
 * The shared fade-up. Plain opacity rather than autoAlpha on purpose: autoAlpha
 * parks the element at visibility:hidden, which drops it out of the
 * accessibility tree and blurs anything focused inside it — the sheet below
 * autofocuses its first action, so a hidden ancestor would throw focus to the
 * body.
 *
 * clearProps matters as much as the tween: a transform left behind makes the
 * element a containing block, which traps position:fixed descendants. That is
 * why the menus and dialogs are portalled to the body; clearing it on land
 * means the page settles with no inline styles at all.
 */
export const RISE: gsap.TweenVars = {
  opacity: 0,
  y: 12,
  duration: DUR.rise,
  ease: EASE,
  clearProps: "opacity,transform",
}

/*
 * Page entry: every [data-rise] inside the scope fades up in DOM order, as one
 * staggered tween per route rather than an animation per element. Keyed on the
 * path so a navigation replays it.
 */
export function useRouteReveal(scope: RefObject<HTMLElement | null>, routeKey: string) {
  useGSAP(
    () => {
      const targets = scope.current?.querySelectorAll("[data-rise]")
      if (!targets?.length || prefersReducedMotion()) return
      gsap.from(targets, { ...RISE, stagger: STAGGER })
    },
    { dependencies: [routeKey], revertOnUpdate: true },
  )
}

/*
 * Sheet and dialog entry: the backdrop fades while the panel rises, on one
 * timeline so the two halves cannot drift apart. `open` doubles as the
 * dependency, since these panels mount and unmount with it.
 */
export function useSheetEnter(
  panel: RefObject<HTMLElement | null>,
  backdrop: RefObject<HTMLElement | null>,
  open: unknown,
) {
  useGSAP(
    () => {
      if (!open || !panel.current || prefersReducedMotion()) return
      const tl = gsap.timeline()
      if (backdrop.current) {
        tl.from(
          backdrop.current,
          { opacity: 0, duration: DUR.fade, ease: "power1.out", clearProps: "opacity" },
          0,
        )
      }
      /*
       * clearProps for the same reason as the reveal: a panel that keeps a
       * transform is a containing block, and these panels hold selects whose
       * popovers measure their trigger against the viewport.
       */
      tl.from(
        panel.current,
        { opacity: 0, y: 28, duration: DUR.sheet, ease: EASE, clearProps: "opacity,transform" },
        0,
      )
    },
    { dependencies: [open], revertOnUpdate: true },
  )
}
