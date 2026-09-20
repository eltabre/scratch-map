import { useCallback, useEffect, useState } from 'react'

export const STORAGE_KEY = 'scratch-map:v1'

function load(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [])
  } catch {
    return new Set()
  }
}

/** The set of visited country keys, persisted to localStorage. */
export function useVisited() {
  const [visited, setVisited] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited]))
    } catch {
      // Storage can be blocked or full; the map still works for this session.
    }
  }, [visited])

  /** Mark every key visited (`on`) or not visited. */
  const set = useCallback((keys: string[], on: boolean) => {
    setVisited((prev) => {
      const next = new Set(prev)
      for (const key of keys) {
        if (on) next.add(key)
        else next.delete(key)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setVisited(new Set()), [])

  /** Throw away the current places and use exactly these instead. */
  const replace = useCallback((keys: Iterable<string>) => setVisited(new Set(keys)), [])

  return { visited, set, clear, replace }
}
