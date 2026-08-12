import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "./api"

/*
 * One read from the API, with the three states a page actually has to draw.
 *
 * `deps` decides when to refetch, the same contract as useEffect. The result of
 * a superseded call is dropped rather than applied: filters change faster than
 * requests come back, and without the guard a slow response for last week's
 * range lands on top of this week's.
 *
 * Reads are cached per tab and served stale-while-revalidate: coming back to a
 * page paints the last answer instantly while the fresh one is fetched behind
 * it. The cache never suppresses a request — every mount and every reload()
 * still asks the API — it only removes the blank-and-spinner wait in between.
 * The key is the fetcher's own source text plus its deps, which is exactly
 * "the same call from the same place"; sign-in and sign-out clear everything,
 * so one account's figures can never flash at another.
 */
export type Async<T> = {
  data: T | null
  loading: boolean
  error: string | null
  /** Re-run the same query, e.g. after a write */
  reload: () => void
}

const cache = new Map<string, unknown>()

/** Forget every cached read — called when the signed-in identity changes */
export function clearApiCache(): void {
  cache.clear()
}

export function useApi<T>(run: () => Promise<T>, deps: unknown[]): Async<T> {
  const key = `${run.toString()}|${JSON.stringify(deps)}`
  const [data, setData] = useState<T | null>(() => (cache.get(key) as T | undefined) ?? null)
  const [loading, setLoading] = useState(() => !cache.has(key))
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  /* Held in refs so inline arrows do not count as dependency changes */
  const runRef = useRef(run)
  runRef.current = run
  const keyRef = useRef(key)
  keyRef.current = key

  useEffect(() => {
    let live = true
    const thisKey = keyRef.current
    const cached = cache.get(thisKey) as T | undefined
    if (cached !== undefined) {
      // The stale answer paints now; the fresh one replaces it when it lands
      setData(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    runRef
      .current()
      .then((value) => {
        cache.set(thisKey, value)
        if (!live) return
        setData(value)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!live) return
        setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.")
        setLoading(false)
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { data, loading, error, reload }
}
