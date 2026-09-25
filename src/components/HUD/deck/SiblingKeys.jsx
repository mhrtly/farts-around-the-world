import { useEffect, useRef } from 'react'
import { formatDay, formatLength } from '../../../utils/recordings.js'
import { measurementsOf } from './measurements.js'
import { rovingKeyDown } from './roving.js'

// Every fart recorded at the same spot, as a row of interlocking preset keys
// numbered in the order they happened (1 = the first one here). The row
// scrolls sideways; the one playing stays latched and in view.
export default function SiblingKeys({ events, selectedId, onSelect }) {
  const scrollRef = useRef(null)
  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const hasActive = ordered.some(event => event.id === selectedId)

  // Fade whichever edge has more keys beyond it
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return undefined
    const update = () => {
      const max = scroller.scrollWidth - scroller.clientWidth
      scroller.classList.toggle('has-before', scroller.scrollLeft > 2)
      scroller.classList.toggle('has-after', scroller.scrollLeft < max - 2)
    }
    update()
    // A mouse wheel scrolls the strip sideways (its scrollbar is hidden)
    const onWheel = event => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      if (scroller.scrollWidth <= scroller.clientWidth) return
      scroller.scrollLeft += event.deltaY
      event.preventDefault()
    }
    scroller.addEventListener('scroll', update, { passive: true })
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      scroller.removeEventListener('scroll', update)
      scroller.removeEventListener('wheel', onWheel)
    }
  }, [events.length])

  useEffect(() => {
    const scroller = scrollRef.current
    const key = scroller?.querySelector('[aria-pressed="true"]')
    if (!scroller || !key) return
    // Measured on screen: offsetLeft would be relative to whichever ancestor
    // happens to be positioned, which isn't the strip
    const keyBox = key.getBoundingClientRect()
    const stripBox = scroller.getBoundingClientRect()
    const target = scroller.scrollLeft + keyBox.left - stripBox.left - (scroller.clientWidth - keyBox.width) / 2
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ left: Math.max(0, target), behavior: reduced ? 'auto' : 'smooth' })
  }, [selectedId, events.length])

  return (
    <div className="siblings">
      <div className="siblings__legend" id="siblings-legend">
        <span className="siblings__count">{events.length}</span> at<br />this spot
      </div>
      <div ref={scrollRef} className="siblings__scroll">
        <div
          className="presets presets--numbered"
          role="group"
          aria-labelledby="siblings-legend"
          onKeyDown={event => rovingKeyDown(event, index => onSelect?.(ordered[index]))}
        >
          {ordered.map((event, i) => {
            const { duration } = measurementsOf(event)
            const active = event.id === selectedId
            const detail = [formatDay(event.timestamp), duration != null ? formatLength(duration) : null].filter(Boolean).join(', ')
            return (
              <button
                key={event.id}
                type="button"
                className="preset"
                aria-pressed={active}
                tabIndex={active || (!hasActive && i === 0) ? 0 : -1}
                aria-label={`Number ${i + 1} here, ${detail}`}
                onClick={() => onSelect?.(event)}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
