import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "./api"

/*
 * One read from the API, with the three states a page actually has to draw.
 *
 * `deps` decides when to refetch, the same contract as useEffect. The result of
 * a superseded call is dropped rather than applied: filters change faster than
 * requests come back, and without the guard a slow response for last week's
 * range lands on top of this week's.
 */
export type Async<T> = {
  data: T | null
  loading: boolean
  error: string | null
  /** Re-run the same query, e.g. after a write */
  reload: () => void
}

export function useApi<T>(run: () => Promise<T>, deps: unknown[]): Async<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  /* Held in a ref so an inline arrow does not count as a dependency change */
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    runRef
      .current()
      .then((value) => {
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
