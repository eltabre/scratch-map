import { useEffect, useState } from 'react'

export const STORAGE_KEY = 'scratch-map:tile-size'
export const TILE_SIZE = { min: 0.6, max: 2.2, step: 0.1, initial: 1 }

function load(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    // A missing key reads as 0, which is out of range and falls back to the default.
    return saved >= TILE_SIZE.min && saved <= TILE_SIZE.max ? saved : TILE_SIZE.initial
  } catch {
    return TILE_SIZE.initial
  }
}

/** How large the flags and park badges are, as a multiple of their default size. Remembered between visits. */
export function useTileSize() {
  const [size, setSize] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(size))
    } catch {
      // Storage can be blocked; the size still works for this session.
    }
  }, [size])

  return [size, setSize] as const
}
