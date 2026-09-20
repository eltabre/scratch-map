import parkImages from '@/data/parkImages.json'
import { PARKS, REGIONS, type CountryCode } from '@/lib/geo'
import Section from './Section'

interface Photo {
  file: string
  artist: string
  license: string
  licenseUrl: string
  /** The photo's page on Wikimedia Commons. */
  page: string
}

const PHOTOS = parkImages as Record<string, Photo | undefined>
const REGION_NAME = Object.fromEntries(REGIONS.map((r) => [r.key, r.name]))

const GROUPS: { country: CountryCode; title: string }[] = [
  { country: 'US', title: 'United States national parks' },
  { country: 'CA', title: 'Canada national parks' },
]

interface Props {
  visited: ReadonlySet<string>
  onToggle: (key: string) => void
}

/** Parks as arched photo badges, dim until visited, with the photo credits below. */
export default function ParksTab({ visited, onToggle }: Props) {
  const credited = PARKS.filter((p) => PHOTOS[p.key])
  return (
    <div className="list-groups">
      {GROUPS.map(({ country, title }) => {
        const parks = PARKS.filter((p) => p.country === country)
        return (
          <Section key={country} title={title} keys={parks.map((p) => p.key)} visited={visited}>
            <ul className="park-tiles">
              {parks.map((park) => {
                const photo = PHOTOS[park.key]
                return (
                  <li key={park.key} data-tip={park.name}>
                    <button
                      type="button"
                      className={`park-tile${visited.has(park.key) ? ' visited' : ''}`}
                      aria-pressed={visited.has(park.key)}
                      aria-label={park.name}
                      onClick={() => onToggle(park.key)}
                    >
                      {photo && <img src={`${import.meta.env.BASE_URL}parks/${photo.file}`} alt="" loading="lazy" />}
                      <span className="park-tile-label">
                        <strong>{park.short}</strong>
                        {park.region && <small>{REGION_NAME[park.region]}</small>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Section>
        )
      })}

      <details className="credits">
        <summary>Photo credits</summary>
        <p>Photos are from Wikimedia Commons, used under the licences shown.</p>
        <ul>
          {credited.map((park) => {
            const photo = PHOTOS[park.key]!
            return (
              <li key={park.key}>
                <strong>{park.short}</strong>: {photo.artist} ·{' '}
                {photo.licenseUrl ? (
                  <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                    {photo.license}
                  </a>
                ) : (
                  photo.license
                )}{' '}
                ·{' '}
                <a href={photo.page} target="_blank" rel="noreferrer">
                  source
                </a>
              </li>
            )
          })}
        </ul>
      </details>
    </div>
  )
}
