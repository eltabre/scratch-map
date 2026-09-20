import keyOrder from '@/data/keyOrder.json'
import { AREAS, PARKS } from '@/lib/geo'

/**
 * Turns the set of visited places into a short string for a shareable link, and back.
 *
 * Every place has a fixed slot in src/data/keyOrder.json (append-only, see
 * scripts/build-key-order.mjs), and the string is one bit per slot, written as
 * URL-safe base64. Trailing empty bytes are dropped, so a nearly empty map gives a
 * very short link. Because slots never move, an old link still decodes correctly
 * after new places are added.
 */

const VERSION = 'v1'

/** Every place that can be marked right now. */
const CURRENT_KEYS = [...AREAS.map((a) => a.key), ...PARKS.map((p) => p.key)]

// Anything missing from the committed list gets a slot after it, so the link still
// works, but only `npm run data:order` makes those slots permanent.
const known = new Set(keyOrder)
const missing = CURRENT_KEYS.filter((k) => !known.has(k)).sort()
if (import.meta.env.DEV && missing.length) {
  console.warn(`keyOrder.json is missing ${missing.length} places; run \`npm run data:order\` before sharing links.`)
}
const ORDER: string[] = [...keyOrder, ...missing]
const SLOT = new Map(ORDER.map((key, i) => [key, i]))

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=')
    return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0))
  } catch {
    return null
  }
}

/** The code for a set of visited places, e.g. "v1.AAAg_w". */
export function encode(visited: ReadonlySet<string>): string {
  const bytes = new Uint8Array(Math.ceil(ORDER.length / 8))
  for (const key of visited) {
    const slot = SLOT.get(key)
    if (slot !== undefined) bytes[slot >> 3] |= 1 << (slot & 7)
  }
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  return `${VERSION}.${toBase64Url(bytes.subarray(0, end))}`
}

export type Decoded = { ok: true; keys: Set<string> } | { ok: false; reason: 'newer' | 'invalid' }

/** Reads a code made by `encode`. */
export function decode(code: string): Decoded {
  const [version, payload = '', ...rest] = code.split('.')
  if (rest.length) return { ok: false, reason: 'invalid' }
  if (version !== VERSION) return { ok: false, reason: /^v\d+$/.test(version) ? 'newer' : 'invalid' }
  const bytes = fromBase64Url(payload)
  if (!bytes) return { ok: false, reason: 'invalid' }

  const keys = new Set<string>()
  ORDER.forEach((key, slot) => {
    if (bytes[slot >> 3] & (1 << (slot & 7))) keys.add(key)
  })
  return { ok: true, keys }
}

/** The full link to share for a set of visited places. */
export function shareUrl(visited: ReadonlySet<string>): string {
  return `${window.location.origin}${window.location.pathname}#${encode(visited)}`
}

/** The shared map in the address bar, if there is one: null when the hash is not a code. */
export function readShared(): Decoded | null {
  const hash = window.location.hash.slice(1)
  return /^v\d+\./.test(hash) ? decode(hash) : null
}
