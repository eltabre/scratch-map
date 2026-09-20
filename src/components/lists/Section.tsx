import type { ReactNode } from 'react'
import './lists.css'

interface Props {
  title: string
  keys: string[]
  visited: ReadonlySet<string>
  children: ReactNode
}

/** A titled group with its own "3 / 63" visited count. */
export default function Section({ title, keys, visited, children }: Props) {
  const done = keys.filter((k) => visited.has(k)).length
  return (
    <section>
      <h2 className="list-heading">
        {title}{' '}
        <span>
          {done} / {keys.length}
        </span>
      </h2>
      {children}
    </section>
  )
}
