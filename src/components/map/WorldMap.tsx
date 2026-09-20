import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { memo, useEffect, useRef } from 'react'
import './WorldMap.css'
import { AREAS, HEIGHT, LAKES, PARKS, WIDTH, type Area, type Park } from '@/lib/geo'

/** Gap between scratch passes, in map units. */
const PASS_GAP = 5

interface Props {
  visited: ReadonlySet<string>
  /** Keys whose foil is still being scratched away. */
  scratching: ReadonlySet<string>
  showParks: boolean
  /** Grow to fill the screen instead of keeping the map's natural proportions. */
  fill: boolean
  onToggle: (key: string) => void
  onHover: (name: string | null) => void
}

/** A zig-zag over the shape's bounding box, thick enough to clear all the foil. */
function scratchPath({ bounds: [[x0, y0], [x1, y1]] }: Area): string {
  const passes = Math.max(2, Math.ceil((y1 - y0) / PASS_GAP) + 1)
  const step = (y1 - y0) / (passes - 1)
  const pad = PASS_GAP
  const points = Array.from({ length: passes }, (_, i) => {
    const y = y0 + i * step
    return i % 2 === 0 ? `${x0 - pad} ${y}L${x1 + pad} ${y}` : `${x1 + pad} ${y}L${x0 - pad} ${y}`
  })
  return 'M' + points.join('L')
}

interface ShapeProps {
  area: Area
  /** Unique per shape, for its scratch mask. */
  index: number
  isVisited: boolean
  isScratching: boolean
  onToggle: (key: string) => void
  onHover: (name: string | null) => void
}

/**
 * One country, state or province. Memoised so that scratching or hovering one shape
 * does not redraw the other 300: on a phone that redraw was most of the delay after a tap.
 */
const AreaShape = memo(function AreaShape({ area, index, isVisited, isScratching, onToggle, onHover }: ShapeProps) {
  const maskId = `scratch-${index}`
  return (
    <g
      className="area"
      onClick={() => onToggle(area.key)}
      onPointerEnter={() => onHover(area.label)}
      onPointerLeave={() => onHover(null)}
    >
      {isVisited && <path className="area-fill" d={area.d} fill={area.color} />}
      {(!isVisited || isScratching) && (
        <path className="area-foil" d={area.d} fill="url(#foil)" mask={isScratching ? `url(#${maskId})` : undefined} />
      )}
      {isScratching && (
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={HEIGHT}>
          <rect width={WIDTH} height={HEIGHT} fill="#fff" />
          <path className="scratch-stroke" d={scratchPath(area)} pathLength={1} strokeWidth={PASS_GAP * 1.7} />
        </mask>
      )}
    </g>
  )
})

interface DotProps {
  park: Park
  isVisited: boolean
  onToggle: (key: string) => void
  onHover: (name: string | null) => void
}

const ParkDot = memo(function ParkDot({ park, isVisited, onToggle, onHover }: DotProps) {
  return (
    <g
      className={`park${isVisited ? ' visited' : ''}`}
      onClick={() => onToggle(park.key)}
      onPointerEnter={() => onHover(park.name)}
      onPointerLeave={() => onHover(null)}
    >
      <circle className="park-hit" cx={park.x} cy={park.y} />
      <circle className="park-dot" cx={park.x} cy={park.y} />
    </g>
  )
})

function WorldMap({ visited, scratching, showParks, fill, onToggle, onHover }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const layerRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  useEffect(() => {
    const svg = select(svgRef.current!)
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .extent([[0, 0], [WIDTH, HEIGHT]])
      .translateExtent([[0, 0], [WIDTH, HEIGHT]])
      .on('zoom', (event) => layerRef.current?.setAttribute('transform', event.transform.toString()))
      // Lets the CSS keep park dots the same size on screen at every zoom. Set once a
      // gesture ends: changing it on every frame made the browser restyle every dot mid-pinch.
      .on('end', (event) => svgRef.current?.style.setProperty('--k', String(event.transform.k)))
    svg.call(behavior)
    zoomRef.current = behavior
    return () => {
      svg.on('.zoom', null)
    }
  }, [])

  function zoomBy(factor: number) {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, factor)
  }

  function resetZoom() {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
  }

  return (
    <div className={`map${fill ? ' fill' : ''}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="World map. Click a country, state or province to scratch it off."
      >
        <defs>
          <pattern id="foil" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="7" height="7" fill="#cfa63f" />
            <rect width="7" height="2.4" fill="#e3c063" />
            <circle cx="3.5" cy="5" r="0.7" fill="#a98428" />
          </pattern>
        </defs>

        <g ref={layerRef}>
          {AREAS.map((area, index) => (
            <AreaShape
              key={area.key}
              area={area}
              index={index}
              isVisited={visited.has(area.key)}
              isScratching={scratching.has(area.key)}
              onToggle={onToggle}
              onHover={onHover}
            />
          ))}

          {/* The Great Lakes, painted over the states and provinces whose borders run out into them. */}
          <path className="lakes" d={LAKES} />

          {showParks &&
            PARKS.map((park) => (
              <ParkDot key={park.key} park={park} isVisited={visited.has(park.key)} onToggle={onToggle} onHover={onHover} />
            ))}
        </g>
      </svg>

      <div className="zoom-controls">
        <button type="button" onClick={() => zoomBy(1.6)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">−</button>
        <button type="button" onClick={resetZoom} aria-label="Reset zoom">⟲</button>
      </div>
    </div>
  )
}

export default memo(WorldMap)
