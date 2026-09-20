import { REGIONS, type CountryCode } from '@/lib/geo'
import Section from './Section'

const GROUPS: { country: CountryCode; title: string }[] = [
  { country: 'US', title: 'US states' },
  { country: 'CA', title: 'Canadian provinces & territories' },
]

const ITEMS = Object.fromEntries(
  GROUPS.map(({ country }) => [
    country,
    REGIONS.filter((r) => r.country === country).sort((a, b) => a.name.localeCompare(b.name)),
  ]),
)

interface Props {
  visited: ReadonlySet<string>
  onToggle: (key: string) => void
}

/** State and province flags: dim until visited, name on hover. */
export default function RegionsTab({ visited, onToggle }: Props) {
  return (
    <div className="list-groups">
      {GROUPS.map(({ country, title }) => (
        <Section key={country} title={title} keys={ITEMS[country].map((r) => r.key)} visited={visited}>
          <ul className="flags region-flags">
            {ITEMS[country].map((region) => {
              const isVisited = visited.has(region.key)
              return (
                <li key={region.key} data-tip={region.name}>
                  <button
                    type="button"
                    className={`flag${isVisited ? ' visited' : ''}`}
                    aria-pressed={isVisited}
                    aria-label={region.name}
                    onClick={() => onToggle(region.key)}
                  >
                    <img src={`${import.meta.env.BASE_URL}flags/regions/${region.key}.png`} alt="" loading="lazy" />
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>
      ))}
    </div>
  )
}
