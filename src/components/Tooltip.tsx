import './Tooltip.css'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface Tip {
  text: string
  /** Viewport x of the hovered element's centre, and its top and bottom edges. */
  x: number
  top: number
  bottom: number
}

/**
 * Shows a tooltip for any descendant carrying a `data-tip` attribute, on hover
 * or keyboard focus. One shared bubble is positioned and kept inside the
 * viewport, which a CSS-only tooltip can't do for flags at the edge of the grid.
 */
export default function TipHost({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const bubble = useRef<HTMLDivElement>(null)

  function show(target: EventTarget) {
    const el = target instanceof Element ? target.closest<HTMLElement>('[data-tip]') : null
    if (!el?.dataset.tip) return setTip(null)
    const rect = el.getBoundingClientRect()
    setTip({ text: el.dataset.tip, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom })
  }

  // The bubble is fixed to the viewport, so it would be left behind by scrolling.
  useEffect(() => {
    const hide = () => setTip(null)
    window.addEventListener('scroll', hide, { passive: true })
    return () => window.removeEventListener('scroll', hide)
  }, [])

  useLayoutEffect(() => {
    const el = bubble.current
    if (!el || !tip) return
    const margin = 8
    const left = Math.min(Math.max(tip.x - el.offsetWidth / 2, margin), window.innerWidth - el.offsetWidth - margin)
    el.style.left = `${left}px`
  }, [tip])

  return (
    <div
      onPointerOver={(e) => show(e.target)}
      onPointerLeave={() => setTip(null)}
      onFocus={(e) => show(e.target)}
      onBlur={() => setTip(null)}
    >
      {children}
      {tip && (
        <div
          ref={bubble}
          className="tooltip"
          role="tooltip"
          style={tip.top < 40 ? { top: tip.bottom + 8 } : { top: tip.top - 8, transform: 'translateY(-100%)' }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}
