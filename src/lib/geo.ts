import { geoNaturalEarth1, geoPath } from 'd3-geo'
import isoCountries from 'i18n-iso-countries'
import { feature, neighbors } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-50m.json'
import parksData from '@/data/parks.json'
import regionsData from '@/data/regions.json'

export const WIDTH = 960
export const HEIGHT = 500

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

/** ISO numeric ids of the countries that are drawn as their states / provinces instead. */
const SPLIT: Record<string, CountryCode> = { '840': 'US', '124': 'CA' }

/** Shapes that world-atlas leaves without an ISO numeric id. */
const CODE_BY_NAME: Record<string, string> = { Kosovo: 'XK' }

const COUNTRY_LABEL: Record<CountryCode, string> = { US: 'USA', CA: 'Canada' }

// Deliberately no yellows or oranges: they read as the gold foil.
const PALETTE = ['#e4572e', '#d6336c', '#8a6fdf', '#4c6ef5', '#4aa3df', '#2fb5a6', '#7bc950', '#f78fb3']

type WorldTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>
type RegionsTopology = Topology<{ regions: GeometryCollection<{ key: string; name: string; country: CountryCode }> }>

const projection = geoNaturalEarth1().fitExtent(
  [
    [4, 4],
    [WIDTH - 4, HEIGHT - 4],
  ],
  { type: 'Sphere' },
)
const path = geoPath(projection)

/**
 * Give every shape a colour that none of its land neighbours has, so two
 * touching shapes never blend together once both are scratched off. A shape with
 * more distinct neighbours than there are colours (China, Russia) reuses the
 * colour its neighbours use least.
 */
function assignColors(geometries: GeometryCollection['geometries']): string[] {
  const adjacent = neighbors(geometries)
  const colors: number[] = []
  geometries.forEach((_, i) => {
    const used = new Array<number>(PALETTE.length).fill(0)
    adjacent[i].forEach((n) => {
      if (colors[n] !== undefined) used[colors[n]]++
    })
    // Start at a different colour per shape so the map is not all one hue, then take
    // the first colour with no neighbour on it (or the least used, if there is none).
    let best = i % PALETTE.length
    for (let step = 0; step < PALETTE.length; step++) {
      const candidate = (i + step) % PALETTE.length
      if (used[candidate] < used[best]) best = candidate
      if (used[candidate] === 0) {
        best = candidate
        break
      }
    }
    colors[i] = best
  })
  return colors.map((c) => PALETTE[c])
}

function build() {
  const worldTopology = world as unknown as WorldTopology
  const regionsTopology = regionsData as unknown as RegionsTopology

  const worldFeatures = feature(worldTopology, worldTopology.objects.countries).features
  const worldColors = assignColors(worldTopology.objects.countries.geometries)
  const regionFeatures = feature(regionsTopology, regionsTopology.objects.regions).features
  const regionColors = assignColors(regionsTopology.objects.regions.geometries)

  const regions: Region[] = regionFeatures.map((f) => f.properties)
  const countries: Country[] = []
  const usedIds = new Set<string>()

  /** Every shape to draw, before it is projected. */
  const shapes: { key: string; label: string; geometry: (typeof worldFeatures)[number] | (typeof regionFeatures)[number]; color: string }[] = []

  worldFeatures.forEach((f, i) => {
    const name = f.properties.name
    // A few dependencies share their parent's id (Ashmore and Cartier Is. has
    // Australia's). Only the first keeps it; the rest are keyed and flagged by name.
    const rawId = f.id === undefined ? null : String(f.id)
    const id = rawId && !usedIds.has(rawId) ? rawId : null
    if (id) usedIds.add(id)
    const split = id ? SPLIT[id] : undefined
    countries.push({
      key: id ?? name,
      name,
      code: (id && isoCountries.numericToAlpha2(id)) || CODE_BY_NAME[name] || null,
      regionKeys: split ? regions.filter((r) => r.country === split).map((r) => r.key) : null,
    })
    if (!split) shapes.push({ key: id ?? name, label: name, geometry: f, color: worldColors[i] })
  })

  regionFeatures.forEach((f, i) => {
    const { key, name, country } = f.properties
    shapes.push({ key, label: `${name}, ${COUNTRY_LABEL[country]}`, geometry: f, color: regionColors[i] })
  })

  const areas: Area[] = shapes.map(({ key, label, geometry, color }) => ({
    key,
    label,
    d: path(geometry) ?? '',
    bounds: path.bounds(geometry),
    color,
  }))

  const parks: Park[] = parksData.flatMap((p) => {
    const point = projection([p.lon, p.lat])
    if (!point) return []
    return [
      {
        key: p.key,
        name: p.name,
        short: p.name.replace(/ National Park( Reserve| and Reserve| and Preserve)?$/, ''),
        country: p.country as CountryCode,
        region: p.region,
        x: point[0],
        y: point[1],
      },
    ]
  })

  return { areas, countries, regions, parks }
}

const built = build()
export const AREAS = built.areas
export const COUNTRIES = built.countries
export const REGIONS = built.regions
export const PARKS = built.parks

/** Park key -> key of the region it is in, for the parks that have one. */
export const PARK_REGION: Record<string, string> = Object.fromEntries(
  PARKS.flatMap((p) => (p.region ? [[p.key, p.region]] : [])),
)

/** A country is visited directly, or, for the US and Canada, when any of its regions is. */
export function isCountryVisited(country: Country, visited: ReadonlySet<string>): boolean {
  return country.regionKeys ? country.regionKeys.some((k) => visited.has(k)) : visited.has(country.key)
}
