import { useState, useEffect, useRef } from 'react'

/**
 * Smoothly rolls a number from its previous value to its new value.
 * Pass a numeric `value`; renders the current interpolated number
 * formatted with toLocaleString().
 */
export default function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef  = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    const to   = value
    if (from === to) return

    const duration = 550
    const startTime = performance.now()

    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - (1 - t) ** 3 // cubic ease-out
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return display.toLocaleString()
}
