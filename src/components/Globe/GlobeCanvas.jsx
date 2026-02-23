import React, { useEffect, useRef } from 'react'
import Globe from 'globe.gl'

const ARC_COLORS = {
  standard:           ['rgba(56,243,255,0.9)',  'rgba(56,243,255,0)'],
  epic:               ['rgba(255,100,255,1)',    'rgba(255,100,255,0)'],
  'silent-but-deadly':['rgba(157,255,74,0.85)', 'rgba(157,255,74,0)'],
}

const POINT_COLORS = {
  standard:           'rgba(56,243,255,0.9)',
  epic:               'rgba(255,100,255,0.95)',
  'silent-but-deadly':'rgba(157,255,74,0.85)',
}

const RING_COLOR_FN = {
  standard:            t => `rgba(56,243,255,${Math.max(0, 1 - t)})`,
  epic:                t => `rgba(255,100,255,${Math.max(0, 1 - t)})`,
  'silent-but-deadly': t => `rgba(157,255,74,${Math.max(0, 1 - t)})`,
}

export default function GlobeCanvas({ events }) {
  const mountRef  = useRef(null)
  const globeRef  = useRef(null)
  const layerTimer = useRef(null)
  const prevCount = useRef(0)

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current || globeRef.current) return

    const g = Globe()(mountRef.current)

    g
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('#38f3ff')
      .atmosphereAltitude(0.22)

      // ── Arcs ──────────────────────────────────────────────────────
      .arcsData([])
      .arcStartLat('lat')
      .arcStartLng('lng')
      .arcEndLat('_endLat')
      .arcEndLng('_endLng')
      .arcColor(d => ARC_COLORS[d.type] ?? ARC_COLORS.standard)
      .arcAltitude(d => 0.02 + d.intensity * 0.04)
      .arcStroke(d => 0.2 + d.intensity * 0.18)
      .arcDashLength(0.35)
      .arcDashGap(0.15)
      .arcDashAnimateTime(1400)
      .arcsTransitionDuration(0)

      // ── Rings (epic + SBD events) ──────────────────────────────────
      .ringsData([])
      .ringLat('lat')
      .ringLng('lng')
      .ringColor(d => RING_COLOR_FN[d.type] ?? RING_COLOR_FN.standard)
      .ringMaxRadius(d => 2.5 + d.intensity * 0.6)
      .ringPropagationSpeed(2.5)
      .ringRepeatPeriod(1400)
      .ringAltitude(0.003)

      // ── Points (recent events as glowing dots) ────────────────────
      .pointsData([])
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.012)
      .pointRadius(d => 0.12 + d.intensity * 0.032)
      .pointColor(d => POINT_COLORS[d.type] ?? POINT_COLORS.standard)
      .pointsMerge(false)
      .pointsTransitionDuration(300)

      // ── HexBin density columns ────────────────────────────────────
      .hexBinPointsData([])
      .hexBinPointLat('lat')
      .hexBinPointLng('lng')
      .hexBinPointWeight('intensity')
      .hexBinResolution(3)
      .hexAltitude(d => Math.min(d.sumWeight * 0.0007, 0.09))
      .hexTopColor(d => {
        const t = Math.min(d.sumWeight / 70, 1)
        return `rgba(${Math.round(40 + t * 175)},${Math.round(220 - t * 70)},255,${0.3 + t * 0.6})`
      })
      .hexSideColor(d => {
        const t = Math.min(d.sumWeight / 70, 1)
        return `rgba(20,60,${Math.round(180 + t * 75)},${0.06 + t * 0.22})`
      })
      .hexBinMerge(true)
      .hexTransitionDuration(700)

      // ── Country labels ─────────────────────────────────────────────
      .labelsData([])
      .labelLat('lat')
      .labelLng('lng')
      .labelText('text')
      .labelColor(() => 'rgba(56,243,255,0.85)')
      .labelSize(0.55)
      .labelDotRadius(0.3)
      .labelDotOrientation(() => 'bottom')
      .labelResolution(3)
      .labelAltitude(0.016)

    // Controls
    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.3
    g.controls().enableDamping = true
    g.controls().dampingFactor = 0.08

    const resize = () => {
      if (mountRef.current) {
        g.width(mountRef.current.clientWidth)
        g.height(mountRef.current.clientHeight)
      }
    }
    resize()
    window.addEventListener('resize', resize)

    globeRef.current = g
    return () => {
      window.removeEventListener('resize', resize)
      globeRef.current = null
    }
  }, [])

  // ── Layer updates ─────────────────────────────────────────────────
  useEffect(() => {
    const g = globeRef.current
    if (!g || events.length === 0) return

    // Immediate: arcs + rings for genuinely new events
    const newCount = events.length
    const newEvents = events.slice(0, newCount - prevCount.current)
    prevCount.current = newCount

    if (newEvents.length > 0) {
      const arcsToAdd = newEvents.map(e => ({
        ...e,
        _endLat: e.lat + (Math.random() * 28 - 14),
        _endLng: e.lng + (Math.random() * 28 - 14),
      }))
      g.arcsData([...arcsToAdd, ...g.arcsData()].slice(0, 80))

      const ringEvents = newEvents.filter(
        e => e.type === 'epic' || e.type === 'silent-but-deadly'
      )
      if (ringEvents.length) {
        const stamped = ringEvents.map(e => ({ ...e, _ts: Date.now() }))
        const alive   = g.ringsData().filter(r => Date.now() - r._ts < 10000)
        g.ringsData([...stamped, ...alive].slice(0, 40))
      }
    }

    // Throttled: points + hexbin + labels (heavier ops)
    clearTimeout(layerTimer.current)
    layerTimer.current = setTimeout(() => {
      const now = Date.now()
      const recent = events.filter(e => now - e.timestamp < 90_000)
      g.pointsData(recent.slice(0, 200))
      g.hexBinPointsData(events.filter(e => now - e.timestamp < 600_000))

      // Country centroid labels — top 6 by event count in last 60s
      const window60 = events.filter(e => now - e.timestamp < 60_000)
      const byCountry = new Map()
      for (const e of window60) {
        const c = byCountry.get(e.country) || { lat: 0, lng: 0, n: 0 }
        byCountry.set(e.country, { lat: c.lat + e.lat, lng: c.lng + e.lng, n: c.n + 1 })
      }
      const labels = [...byCountry.entries()]
        .sort((a, b) => b[1].n - a[1].n)
        .slice(0, 6)
        .map(([country, s]) => ({ lat: s.lat / s.n, lng: s.lng / s.n, text: country }))
      g.labelsData(labels)
    }, 400)

  }, [events])

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', background: 'transparent' }} />
  )
}
