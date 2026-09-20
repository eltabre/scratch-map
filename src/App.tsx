import { lazy, Suspense, useState, type CSSProperties } from 'react'
import './App.css'
import { COUNTRIES, PARKS, PARK_REGION, REGIONS, isCountryVisited } from '@/lib/geo'
import ParksTab from '@/components/lists/ParksTab'
import RegionsTab from '@/components/lists/RegionsTab'
import WorldMap from '@/components/map/WorldMap'
import TipHost from '@/components/Tooltip'
import { TILE_SIZE, useTileSize } from '@/hooks/useTileSize'
import { useVisited } from '@/hooks/useVisited'
import { SCRATCH_MS } from '@/lib/scratch'

// The country flags are a large chunk and only the Countries tab needs them, so
// they load after the map has already appeared.
const CountriesTab = lazy(() => import('@/components/lists/CountriesTab'))

type Tab = 'countries' | 'regions' | 'parks'

const TABS: { id: Tab; label: string }[] = [
  { id: 'countries', label: 'Countries' },
  { id: 'regions', label: 'States & provinces' },
  { id: 'parks', label: 'National parks' },
]

const keysOf = (items: { key: string }[]) => items.map((item) => item.key)
const STATE_KEYS = keysOf(REGIONS.filter((r) => r.country === 'US'))
const PROVINCE_KEYS = keysOf(REGIONS.filter((r) => r.country === 'CA'))
const PARK_KEYS = keysOf(PARKS)

export default function App() {
  const { visited, set, clear } = useVisited()
  const [hovered, setHovered] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('countries')
  // Hiding the lists lets the map fill the screen.
  const [collapsed, setCollapsed] = useState(false)
  const [tileSize, setTileSize] = useTileSize()
  const [showParks, setShowParks] = useState(true)
  // Keys whose foil is still being scratched away on the map.
  const [scratching, setScratching] = useState<ReadonlySet<string>>(new Set())

  function scratch(keys: string[]) {
    setScratching((prev) => new Set([...prev, ...keys]))
    setTimeout(() => {
      setScratching((prev) => new Set([...prev].filter((k) => !keys.includes(k))))
    }, SCRATCH_MS)
  }

  /** Scratch a place off, or cover it back up. Marking a park also marks its state or province. */
  function toggle(key: string) {
    if (visited.has(key)) {
      set([key], false)
      return
    }
    const region = PARK_REGION[key]
    const added = [key, ...(region && !visited.has(region) ? [region] : [])]
    set(added, true)
    scratch(added)
  }

  /** Clicking the open tab again hides the lists; clicking any tab while hidden shows them. */
  function selectTab(id: Tab) {
    setCollapsed(!collapsed && id === tab)
    setTab(id)
  }

  // Saved keys that no longer match anything are ignored rather than counted.
  const tally = (label: string, keys: string[]) => ({ label, done: keys.filter((k) => visited.has(k)).length, total: keys.length })
  const stats = [
    { label: 'Places', done: COUNTRIES.filter((c) => isCountryVisited(c, visited)).length, total: COUNTRIES.length },
    tally('States', STATE_KEYS),
    tally('Provinces', PROVINCE_KEYS),
    tally('Parks', PARK_KEYS),
  ]
  const anything = stats.some((s) => s.done > 0)

  function handleReset() {
    if (window.confirm('Cover everything back up?')) clear()
  }

  return (
    <main className={`app${collapsed ? ' wide' : ''}`} style={{ '--tile-scale': tileSize } as CSSProperties}>
      <header className="header">
        <h1>Scratch Map</h1>
        <dl className="stats" aria-live="polite">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>
                <strong>{s.done}</strong> / {s.total}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <WorldMap visited={visited} scratching={scratching} showParks={showParks} fill={collapsed} onToggle={toggle} onHover={setHovered} />

      <div className="map-bar">
        <p className="status">{hovered ?? 'Click to scratch a place off. Click again to cover it back up.'}</p>
        <label className="parks-toggle">
          <input type="checkbox" checked={showParks} onChange={(e) => setShowParks(e.target.checked)} /> Parks
        </label>
        <button type="button" className="reset" onClick={handleReset} disabled={!anything}>
          Reset
        </button>
      </div>

      <div className="tabs">
        <div role="tablist" className="tab-list">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id && !collapsed}
              className={`tab${tab === id && !collapsed ? ' active' : ''}`}
              onClick={() => selectTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tabs-tools">
          {!collapsed && (
            <label className="size-control" title="Size of the flags and park badges">
              Size
              <input
                type="range"
                min={TILE_SIZE.min}
                max={TILE_SIZE.max}
                step={TILE_SIZE.step}
                value={tileSize}
                onChange={(e) => setTileSize(Number(e.target.value))}
                aria-label="Size of the flags and park badges"
              />
            </label>
          )}
          <button
            type="button"
            className="tabs-toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show lists' : 'Hide lists'}
            title={collapsed ? 'Show lists' : 'Hide lists'}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '▴' : '▾'}
          </button>
        </div>
      </div>

      <TipHost>
        {!collapsed && (
          <Suspense fallback={null}>
            {tab === 'countries' && <CountriesTab visited={visited} onToggle={toggle} />}
            {tab === 'regions' && <RegionsTab visited={visited} onToggle={toggle} />}
            {tab === 'parks' && <ParksTab visited={visited} onToggle={toggle} />}
          </Suspense>
        )}
      </TipHost>
    </main>
  )
}
