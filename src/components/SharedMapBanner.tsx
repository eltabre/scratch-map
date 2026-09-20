import type { Decoded } from '@/lib/shareCode'
import './SharedMapBanner.css'

interface Props {
  shared: Decoded
  /** Whether the visitor already has places marked on their own map. */
  hasOwn: boolean
  onReplace: () => void
  onMerge: () => void
  onDismiss: () => void
}

/** Shown when the page is opened from a shared link, so it never silently overwrites saved progress. */
export default function SharedMapBanner({ shared, hasOwn, onReplace, onMerge, onDismiss }: Props) {
  if (!shared.ok) {
    return (
      <div className="shared-banner" role="status">
        <p>
          {shared.reason === 'newer'
            ? 'That link was made by a newer version of this map, so it can’t be opened here.'
            : 'That link isn’t a valid shared map.'}
        </p>
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    )
  }

  const count = shared.keys.size
  return (
    <div className="shared-banner" role="status">
      <p>
        Someone shared a map with <strong>{count}</strong> {count === 1 ? 'place' : 'places'}.
        {hasOwn && ' You already have your own map saved.'}
      </p>
      <div className="shared-banner-actions">
        <button type="button" className="primary" onClick={onReplace}>
          {hasOwn ? 'Replace mine' : 'Load it'}
        </button>
        {hasOwn && (
          <button type="button" onClick={onMerge}>
            Add to mine
          </button>
        )}
        <button type="button" onClick={onDismiss}>
          Ignore
        </button>
      </div>
    </div>
  )
}
