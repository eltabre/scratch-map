import type { ComponentType } from 'react'
import * as flagComponents from 'country-flag-icons/react/3x2'
import './lists.css'
import { COUNTRIES, isCountryVisited, type Country } from '@/lib/geo'

type FlagComponent = ComponentType<{ 'aria-hidden'?: boolean; className?: string }>
const FLAGS = flagComponents as unknown as Record<string, FlagComponent | undefined>

interface Entry {
  country: Country
  Flag: FlagComponent
}

/** Every country that has a flag, alphabetically. */
const ENTRIES: Entry[] = COUNTRIES.flatMap((country) => {
  const Flag = country.code ? FLAGS[country.code] : undefined
  return Flag ? [{ country, Flag }] : []
}).sort((a, b) => a.country.name.localeCompare(b.country.name))

interface Props {
  visited: ReadonlySet<string>
  onToggle: (key: string) => void
}

/**
 * A flag per country, dim until visited. Also a keyboard-friendly way to mark
 * countries. The US and Canada light up on their own once a state or province is
 * scratched, so their flags are not buttons.
 */
export default function CountriesTab({ visited, onToggle }: Props) {
  return (
    <ul className="flags">
      {ENTRIES.map(({ country, Flag }) => {
        const isVisited = isCountryVisited(country, visited)
        const derived = country.regionKeys !== null
        return (
          <li key={country.key} data-tip={derived ? `${country.name}: scratch a state or province to visit` : country.name}>
            <button
              type="button"
              className={`flag${isVisited ? ' visited' : ''}`}
              aria-pressed={isVisited}
              disabled={derived}
              aria-label={country.name}
              onClick={() => onToggle(country.key)}
            >
              <Flag aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
