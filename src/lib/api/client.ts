/*
 * The HTTP plumbing: one place that knows the base URL, how errors come back,
 * and how files are sent.
 *
 * Credentials travel as a cookie (`credentials: "include"`), not as a bearer
 * token held in JS. A token in localStorage is readable by any script that
 * ends up on the page; an httpOnly cookie is not. The backend sets it at
 * sign-in and the browser never sees it.
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { credentials: "include", ...init })
  } catch {
    // fetch only rejects on a transport failure, so this is the offline case
    throw new ApiError(0, "No connection. Check the branch's internet and try again.")
  }

  const body = await parse(res)
  if (!res.ok) {
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

/** Multipart, for anything carrying a photo */
export function upload<T>(path: string, fields: Record<string, unknown>, files: Record<string, File[]>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue
    form.append(key, typeof value === "string" ? value : JSON.stringify(value))
  }
  for (const [key, list] of Object.entries(files)) {
    list.forEach((file) => form.append(key, file, file.name))
  }
  // No Content-Type header: the browser must set the multipart boundary itself
  return request<T>(path, { method: "POST", body: form })
}
