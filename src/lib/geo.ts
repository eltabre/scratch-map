import map from '@/data/map.json'

/**
 * The shapes, regions and parks the app draws. All of the projection work was done
 * ahead of time by scripts/build-map.mjs (see there for why), so this only loads the
 * result and gives it types.
 */

export const WIDTH: number = map.width
export const HEIGHT: number = map.height

export type CountryCode = 'US' | 'CA'

/** One scratchable shape on the map: a country, or a US state / Canadian province. */
export interface Area {
  /** Stable id used for saving: an ISO numeric code, an ISO 3166-2 code ("US-CA"), or a name. */
  key: string
  /** Shown on hover. */
  label: string
  /** SVG path in the WIDTH x HEIGHT map space. */
  d: string
  /** [[x0, y0], [x1, y1]] of the shape, used to size the scratch animation. */
  bounds: [[number, number], [number, number]]
  /** Colour shown once the foil is scratched off. */
  color: string
}

/** A row in the country list. The US and Canada are visited through their regions. */
export interface Country {
  key: string
  name: string
  /** ISO 3166-1 alpha-2, used to pick a flag. Null when the shape has no code. */
  code: string | null
  /** Keys of the states or provinces that make up this country, if it is drawn that way. */
  regionKeys: string[] | null
}

export interface Region {
  key: string
  name: string
  country: CountryCode
}

export interface Park {
  key: string
  name: string
  /** The name without "National Park" and friends, for compact lists. */
  short: string
  country: CountryCode
  /** Key of the state or province it is in. Null for territories. */
  region: string | null
  /** Position in the map's WIDTH x HEIGHT space. */
  x: number
  y: number
}

export const AREAS = map.areas as unknown as Area[]
/** The Great Lakes as one SVG path, painted over the shapes that run out across them. */
export const LAKES: string = map.lakes
export const COUNTRIES = map.countries as unknown as Country[]
export const REGIONS = map.regions as unknown as Region[]
export const PARKS = map.parks as unknown as Park[]

/** Park key -> key of the region it is in, for the parks that have one. */
export const PARK_REGION: Record<string, string> = Object.fromEntries(
  PARKS.flatMap((p) => (p.region ? [[p.key, p.region]] : [])),
)

/** A country is visited directly, or, for the US and Canada, when any of its regions is. */
export function isCountryVisited(country: Country, visited: ReadonlySet<string>): boolean {
  return country.regionKeys ? country.regionKeys.some((k) => visited.has(k)) : visited.has(country.key)
}
