import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
import "@fontsource-variable/newsreader/opsz.css"
import "@fontsource-variable/newsreader/opsz-italic.css"
import "./index.css"
import App from "./App.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/* The service worker exists for push reminders only — see public/sw.js. It
   needs a secure context, which localhost and the deployed origin both are. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* No worker, no reminders — the rest of the app is unaffected */
    })
  })
}
