/*
 * Stages the built PWA into the Laravel backend's public/ directory, the
 * shape production serves: one origin, the API under /api and the app
 * everywhere else. index.html becomes app.html so it can never shadow
 * Laravel's index.php; everything else copies as-is. Laravel's own files
 * (index.php, .htaccess, robots.txt, favicon.ico) are never touched.
 *
 * Run `npm run build` first (or `npm run stage`, which does both).
 * Override the backend location with BACKEND_DIR when it moves.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, renameSync } from "node:fs"
import { join, resolve } from "node:path"

const FRONTEND = resolve(import.meta.dirname, "..")
const BACKEND =
  process.env.BACKEND_DIR ??
  resolve(FRONTEND, "..", "..", "backend projects", "twowheelszone-manager-api")

const dist = join(FRONTEND, "dist")
const target = join(BACKEND, "public")

if (!existsSync(dist)) {
  console.error("No dist/ found — run `npm run build` first.")
  process.exit(1)
}
if (!existsSync(join(BACKEND, "artisan"))) {
  console.error(`No Laravel app at ${BACKEND} — set BACKEND_DIR.`)
  process.exit(1)
}

/* A stale assets/ dir would pile up old hashed bundles forever */
rmSync(join(target, "assets"), { recursive: true, force: true })
rmSync(join(target, "app.html"), { force: true })

for (const entry of readdirSync(dist)) {
  const from = join(dist, entry)
  if (entry === "index.html") {
    cpSync(from, join(target, "app.html"))
    continue
  }
  cpSync(from, join(target, entry), { recursive: true })
}

// Belt and braces: never leave a competing index.html beside index.php
if (existsSync(join(target, "index.html"))) {
  renameSync(join(target, "index.html"), join(target, "app.html"))
}
mkdirSync(join(target, "assets"), { recursive: true })

console.log(`Staged ${dist} -> ${target} (index.html as app.html)`)
