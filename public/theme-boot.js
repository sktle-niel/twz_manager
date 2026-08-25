/*
 * Runs before the first paint, from <head>, so a device in dark mode never
 * sees a flash of the light canvas while the app bundle loads. Mirrors the
 * resolution in src/lib/theme.ts: an explicit choice in localStorage wins,
 * otherwise the OS setting. A separate file rather than an inline script
 * because the backend's Content-Security-Policy allows scripts from this
 * origin only.
 *
 * The two canvas hexes are duplicated from src/index.css on purpose: the
 * stylesheet may not have loaded yet when this runs, so the browser chrome
 * (address bar, the installed app's status bar) has to be told directly.
 * Once the bundle is up, theme.ts reads the live token instead.
 */
;(function () {
  try {
    var stored = localStorage.getItem("twz-theme")
    var dark =
      stored === "dark" ||
      (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.dataset.theme = dark ? "dark" : "light"
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = dark ? "#131412" : "#f8f7f4"
  } catch (e) {
    /* No storage, no matchMedia: the stylesheet's light default stands */
  }
})()
