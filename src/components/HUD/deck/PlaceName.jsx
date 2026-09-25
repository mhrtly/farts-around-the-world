import { useLayoutEffect, useRef } from 'react'

// The place name as a dot-matrix line: as big as fits on one line, down to
// ONE_LINE_MIN; below that it wraps onto two lines (never smaller than 14 px,
// the Doto floor) and anything longer is clamped. Characters light up one by
// one (14 ms each, the whole name within 300 ms) every time the name changes.

const MAX = 22
const ONE_LINE_MIN = 17
const TWO_LINE_MAX = 18
const FLOOR = 14
const LINE_HEIGHT = 1.12

export default function PlaceName({ text, as: Tag = 'h2', className = '' }) {
  const ref = useRef(null)
  const chars = [...(text || '')]
  const step = chars.length ? Math.min(14, 300 / chars.length) : 0

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let lastWidth = -1

    const fit = () => {
      const width = el.clientWidth
      if (!width) return
      lastWidth = width
      el.style.fontSize = `${MAX}px`
      el.classList.add('is-measuring')
      const natural = el.scrollWidth
      el.classList.remove('is-measuring')
      if (natural <= width) return
      // Letter spacing is in em, so the line's width scales with the size
      const oneLine = Math.floor(((MAX * width) / natural) * 2) / 2
      if (oneLine >= ONE_LINE_MIN) {
        el.style.fontSize = `${oneLine}px`
        return
      }
      let size = Math.max(FLOOR, Math.min(TWO_LINE_MAX, Math.floor((MAX * width * 1.8) / natural)))
      el.style.fontSize = `${size}px`
      el.classList.add('is-measuring-wrap')
      while (size > FLOOR && el.scrollHeight > size * LINE_HEIGHT * 2 + 2) {
        size -= 1
        el.style.fontSize = `${size}px`
      }
      el.classList.remove('is-measuring-wrap')
    }

    fit()
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) fit()
    })
    observer.observe(el)
    // The face arrives after first paint on a cold load
    let alive = true
    document.fonts?.ready?.then(() => { if (alive) fit() })
    const onFonts = () => fit()
    document.fonts?.addEventListener?.('loadingdone', onFonts)
    return () => {
      alive = false
      observer.disconnect()
      document.fonts?.removeEventListener?.('loadingdone', onFonts)
    }
  }, [text])

  return (
    <Tag ref={ref} className={`place-name ${className}`}>
      <span className="sr-only">{text}</span>
      <span key={text} className="place-name__chars" aria-hidden="true">
        {chars.map((ch, i) => (
          <span key={i} style={{ '--d': `${Math.round(i * step)}ms` }}>{ch}</span>
        ))}
      </span>
    </Tag>
  )
}
