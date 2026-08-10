/*
 * The HTTP plumbing: one place that knows the base URL, how errors come back,
 * and how files are sent.
 *
 * Credentials travel as a cookie (`credentials: "include"`), not as a bearer
 * token held in JS. A token in localStorage is readable by any script that
 * ends up on the page; an httpOnly cookie is not. The backend sets it at
 * sign-in and the browser never sees it.
 *
 * Every 401 raises the `unauthorized` event so the session provider can drop
 * to the signed-out state — a session can expire mid-use, and the page that
 * happened to make the next request is the wrong place to handle that.
 *
 * Nothing here knows about Loyverse. The POS token has no scopes at all — it
 * grants full write access to the whole merchant account — so it lives only on
 * the backend. See docs/LOYVERSE.md.
 */

export class ApiError extends Error {
  /* Written out rather than declared as constructor parameters: the project
     builds with `erasableSyntaxOnly`, which rules parameter properties out. */
  readonly status: number
  /** Field-level messages, so a form can show them where they belong */
  readonly fields?: Record<string, string>

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.fields = fields
  }
}

const BASE = import.meta.env.VITE_API_URL ?? "/api"

/* Long enough for a slow mobile connection, short enough that a stalled
   request surfaces as an error with a retry rather than an endless spinner.
   Uploads carry photos over shop wifi, so they get several times more. */
const READ_TIMEOUT_MS = 20_000
const UPLOAD_TIMEOUT_MS = 120_000

const UNAUTHORIZED_EVENT = "twz:unauthorized"

/** Fired whenever any request comes back 401. Returns the unsubscribe. */
export function onUnauthorized(handler: () => void): () => void {
  window.addEventListener(UNAUTHORIZED_EVENT, handler)
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
}

/*
 * Connection health, as the requests themselves experience it. The pages
 * already render their own inline failures; these signals exist for the one
 * global listener that turns them into toasts, so a branch on bad wifi hears
 * about the connection once instead of deciphering five broken cards.
 */
export type NetworkSignal = "offline" | "slow" | "server-error"

const NETWORK_EVENT = "twz:network"

/* A read slower than this is worth saying out loud, even when it succeeds */
const SLOW_READ_MS = 4500

function signal(kind: NetworkSignal): void {
  window.dispatchEvent(new CustomEvent<NetworkSignal>(NETWORK_EVENT, { detail: kind }))
}

/** Fired on offline, slow, and 5xx experiences. Returns the unsubscribe. */
export function onNetworkSignal(handler: (kind: NetworkSignal) => void): () => void {
  const listen = (event: Event) => handler((event as CustomEvent<NetworkSignal>).detail)
  window.addEventListener(NETWORK_EVENT, listen)
  return () => window.removeEventListener(NETWORK_EVENT, listen)
}

/** Errors a person can act on, rather than the raw failure */
function humanise(status: number, body: unknown): string {
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = (body as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  if (status === 401) return "Your session has expired. Sign in again."
  if (status === 403) return "You do not have access to that."
  if (status === 404) return "That is no longer there."
  if (status === 429) return "Too many requests just now. Try again in a moment."
  if (status >= 500) return "The server had a problem. Try again shortly."
  return "That did not go through."
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = READ_TIMEOUT_MS): Promise<T> {
  const startedAt = performance.now()
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      signal: AbortSignal.timeout(timeoutMs),
      ...init,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      signal("slow")
      throw new ApiError(0, "The server is taking too long. Try again.")
    }
    // fetch only rejects on a transport failure, so this is the offline case
    signal("offline")
    throw new ApiError(0, "No connection. Check the branch's internet and try again.")
  }

  // Made it, but slowly — the person waiting deserves to know why
  if (performance.now() - startedAt > SLOW_READ_MS) signal("slow")

  const body = await parse(res)
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    if (res.status >= 500) signal("server-error")
    const fields =
      typeof body === "object" && body !== null && "fields" in body
        ? ((body as { fields?: Record<string, string> }).fields ?? undefined)
        : undefined
    throw new ApiError(res.status, humanise(res.status, body), fields)
  }
  return body as T
}

export function get<T>(path: string, query?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue
    // Repeated keys rather than a joined list: unambiguous when a branch name
    // or a category ever contains a comma
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
    else params.set(key, value)
  }
  const qs = params.toString()
  return request<T>(qs ? `${path}?${qs}` : path)
}

export function send<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
) {
  return request<T>(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/**
 * Multipart, for anything carrying a photo. One convention across every
 * endpoint: the non-file fields travel as a single `payload` part holding the
 * same JSON object a bodied request would send, and each file list becomes
 * repeated parts under its own name. The backend parses `payload` exactly as
 * it would a JSON body — no per-endpoint field encoding to reverse-engineer.
 */
export function upload<T>(
  method: "POST" | "PATCH",
  path: string,
  payload: Record<string, unknown>,
  files: Record<string, File[]>,
) {
  const form = new FormData()
  form.append("payload", JSON.stringify(payload))
  for (const [key, list] of Object.entries(files)) {
    /* The [] suffix matters: PHP keeps only the LAST of repeated bare part
       names, so "receipts" twice arrives as one file. "receipts[]" twice
       arrives as two. */
    list.forEach((file) => form.append(`${key}[]`, file, file.name))
  }
  /* PHP cannot parse a multipart PATCH body at all — only POST. The wire
     carries POST + _method=PATCH (Laravel's method spoofing), and the
     contract stays a logical PATCH. */
  if (method !== "POST") form.append("_method", method)
  // No Content-Type header: the browser must set the multipart boundary itself
  return request<T>(path, { method: "POST", body: form }, UPLOAD_TIMEOUT_MS)
}
