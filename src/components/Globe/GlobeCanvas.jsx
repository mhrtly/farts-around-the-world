import React, { useEffect, useRef, useState } from 'react'
import Globe from 'globe.gl'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ANALYST_NOTES } from '../../config/humor.ts'

// ── Color palette ────────────────────────────────────────────────────────────

const CLOUD_COLOR_HEX = {
  standard:           0x38f3ff,
  epic:               0xff64ff,
  'silent-but-deadly': 0x9dff4a,
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

const TYPE_LABELS = {
  standard:           'STANDARD',
  epic:               'EPIC',
  'silent-but-deadly':'SILENT-BUT-DEADLY',
}

const TYPE_CSS_COLOR = {
  standard:           'var(--accent-cyan)',
  epic:               'var(--accent-pink)',
  'silent-but-deadly':'var(--accent-lime)',
}

// Altitude gained per second as the puff rises
const RISE_SPEED = {
  standard:           0.015,
  epic:               0.020,
  'silent-but-deadly': 0.008,  // creeping, ominous
}

const PUFF_LIFETIME_MS = 5000

// ── Puff helpers ─────────────────────────────────────────────────────────────

function makePuffMesh(event) {
  const isEpic = event.type === 'epic'
  const isSBD  = event.type === 'silent-but-deadly'

  const baseRadius = isEpic ? 0.4 + event.intensity * 0.18
                   : isSBD  ? 0.22 + event.intensity * 0.10
                   :          0.25 + event.intensity * 0.12

  const geometry = new THREE.SphereGeometry(baseRadius, 8, 6)
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(CLOUD_COLOR_HEX[event.type] ?? CLOUD_COLOR_HEX.standard),
    transparent: true,
    opacity: isEpic ? 0.9 : 0.72,
  })
  return new THREE.Mesh(geometry, material)
}

function getPuffAltitude(puff) {
  const ageSec = (Date.now() - puff._birthTime) / 1000
  const speed  = RISE_SPEED[puff.type] ?? RISE_SPEED.standard
  return 0.01 + ageSec * speed
}

function getPuffOpacity(puff) {
  const ageFrac   = (Date.now() - puff._birthTime) / PUFF_LIFETIME_MS
  const startOpac = puff.type === 'epic' ? 0.9 : 0.72
  return Math.max(0, startOpac * (1 - ageFrac))
}

// ── Overlay helpers ──────────────────────────────────────────────────────────

function formatUTC(ts) {
  return new Date(ts).toISOString().slice(11, 19) + ' UTC'
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GlobeCanvas({ events }) {
  const mountRef   = useRef(null)
  const globeRef   = useRef(null)
  const puffsRef   = useRef([])        // live puff data array
  const layerTimer = useRef(null)
  const puffTimer  = useRef(null)
  const prevCount  = useRef(0)

  const [selectedEvent, setSelectedEvent] = useState(null)
  const analystNote = useRef('')

  // Audio playback state
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const audioRef = useRef(null)

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current || globeRef.current) return

    const g = Globe()(mountRef.current)

    g
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('#38f3ff')
      .atmosphereAltitude(0.22)

      // ── Rising cloud puffs (Task 1) ────────────────────────────────────
      .objectsData([])
      .objectLat('lat')
      .objectLng('lng')
      .objectAltitude(d => getPuffAltitude(d))
      .objectThreeObject(d => {
        // Cache mesh on datum — prevents globe.gl recreating it each tick
        if (!d._mesh) d._mesh = makePuffMesh(d)
        return d._mesh
      })
      .onObjectClick(obj => {
        analystNote.current = randomItem(ANALYST_NOTES)
        setSelectedEvent(obj)
        g.controls().autoRotate = false
      })

      // ── Rings — shockwaves for epic + SBD ─────────────────────────────
      .ringsData([])
      .ringLat('lat')
      .ringLng('lng')
      .ringColor(d => RING_COLOR_FN[d.type] ?? RING_COLOR_FN.standard)
      .ringMaxRadius(d => 2.5 + d.intensity * 0.6)
      .ringPropagationSpeed(2.5)
      .ringRepeatPeriod(1400)
      .ringAltitude(0.003)

      // ── Points — ground-level location markers ─────────────────────────
      .pointsData([])
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.012)
      .pointRadius(d => 0.12 + d.intensity * 0.032)
      .pointColor(d => POINT_COLORS[d.type] ?? POINT_COLORS.standard)
      .pointsMerge(false)
      .pointsTransitionDuration(300)
      .onPointClick(point => {
        analystNote.current = randomItem(ANALYST_NOTES)
        setSelectedEvent(point)
        g.controls().autoRotate = false
      })

      // ── HexBin density columns ─────────────────────────────────────────
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

      // ── Country labels ─────────────────────────────────────────────────
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

      // Click empty globe → dismiss overlay, resume rotate
      .onGlobeClick(() => {
        setSelectedEvent(null)
        g.controls().autoRotate = true
      })

    // Controls
    g.controls().autoRotate      = true
    g.controls().autoRotateSpeed = 0.3
    g.controls().enableDamping   = true
    g.controls().dampingFactor   = 0.08

    // ── UnrealBloomPass (Task 2) ───────────────────────────────────────
    const renderer = g.renderer()
    const scene    = g.scene()
    const camera   = g.camera()

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.75,  // strength — visible but not washed out
      0.4,   // radius
      0.65   // threshold — catches cyan, pink, and lime
    )
    composer.addPass(bloomPass)

    // Intercept renderer.render so globe.gl's internal loop renders
    // through the EffectComposer instead of directly to screen.
    // The flag prevents infinite recursion when composer calls renderer.render.
    let composerActive = false
    const _render = renderer.render.bind(renderer)
    renderer.render = (sc, cam) => {
      if (composerActive) return _render(sc, cam)
      composerActive = true
      composer.render()
      composerActive = false
    }

    // ── Puff animation loop ────────────────────────────────────────────
    // Runs at 20fps: removes expired puffs, updates mesh opacity/scale,
    // then pushes updated data to globe.gl so altitude accessors re-fire.
    puffTimer.current = setInterval(() => {
      const now = Date.now()

      // Expire old puffs
      puffsRef.current = puffsRef.current.filter(
        p => now - p._birthTime < PUFF_LIFETIME_MS
      )

      // Update Three.js mesh properties directly
      for (const p of puffsRef.current) {
        if (p._mesh) {
          p._mesh.material.opacity = getPuffOpacity(p)
          // Gentle expansion as the puff rises
          const ageFrac = (now - p._birthTime) / PUFF_LIFETIME_MS
          p._mesh.scale.setScalar(1 + ageFrac * 0.7)
        }
      }

      // Push to globe.gl — this re-fires objectAltitude, making puffs rise
      if (globeRef.current) {
        globeRef.current.objectsData([...puffsRef.current])
      }
    }, 50)

    // Resize handler — keeps composer and bloom pass in sync
    const resize = () => {
      if (!mountRef.current) return
      const w = mountRef.current.clientWidth
      const h = mountRef.current.clientHeight
      g.width(w)
      g.height(h)
      composer.setSize(w, h)
      bloomPass.resolution.set(w, h)
    }
    resize()
    window.addEventListener('resize', resize)

    globeRef.current = g

    return () => {
      window.removeEventListener('resize', resize)
      clearInterval(puffTimer.current)
      renderer.render = _render  // restore original renderer
      globeRef.current = null
    }
  }, [])

  // ── New events → spawn puffs + update rings/points/hexbin ───────────────
  useEffect(() => {
    const g = globeRef.current
    if (!g || events.length === 0) return

    const newCount  = events.length
    const newEvents = events.slice(0, newCount - prevCount.current)
    prevCount.current = newCount

    if (newEvents.length > 0) {
      // Spawn a puff for each new event
      const newPuffs = newEvents.map(e => ({
        ...e,
        _birthTime: Date.now(),  // animation clock starts on arrival
        _mesh: null,
      }))
      puffsRef.current = [...newPuffs, ...puffsRef.current].slice(0, 60)

      // Rings for epic + SBD only
      const ringEvents = newEvents.filter(
        e => e.type === 'epic' || e.type === 'silent-but-deadly'
      )
      if (ringEvents.length) {
        const stamped = ringEvents.map(e => ({ ...e, _ts: Date.now() }))
        const alive   = g.ringsData().filter(r => Date.now() - r._ts < 10000)
        g.ringsData([...stamped, ...alive].slice(0, 40))
      }
    }

    // Throttled: points + hexbin + labels (heavier)
    clearTimeout(layerTimer.current)
    layerTimer.current = setTimeout(() => {
      const now    = Date.now()
      const recent = events.filter(e => now - e.timestamp < 90_000)
      g.pointsData(recent.slice(0, 200))
      g.hexBinPointsData(events.filter(e => now - e.timestamp < 600_000))

      // Top 6 countries by event count in last 60s → floating labels
      const window60  = events.filter(e => now - e.timestamp < 60_000)
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

  // ── Stop audio when selected event changes ──────────────────────────────
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setAudioPlaying(false)
    setAudioLoading(false)
  }, [selectedEvent])

  const playAudio = async (eventId) => {
    // Toggle off if already playing
    if (audioPlaying && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setAudioPlaying(false)
      return
    }
    setAudioLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/audio`)
      if (!res.ok) throw new Error('No audio')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        setAudioPlaying(false)
        URL.revokeObjectURL(url)
      }
      audioRef.current = audio
      await audio.play()
      setAudioPlaying(true)
    } catch {
      // silently fail — no audio available
    } finally {
      setAudioLoading(false)
    }
  }

  // ── Escape key → dismiss overlay ─────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && selectedEvent) {
        setSelectedEvent(null)
        if (globeRef.current) globeRef.current.controls().autoRotate = true
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedEvent])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      />

      {/* Task 3 — Event Intercept overlay */}
      {selectedEvent && (
        <div style={{
          position:         'absolute',
          top:              '50%',
          right:            '20px',
          transform:        'translateY(-50%)',
          background:       'var(--panel-glass)',
          backdropFilter:   'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border:           '1px solid rgba(56,243,255,0.2)',
          borderRadius:     'var(--radius)',
          padding:          '16px 20px',
          minWidth:         '265px',
          fontFamily:       'monospace',
          fontSize:         '12px',
          lineHeight:       '1.7',
          zIndex:           100,
          boxShadow:        '0 0 24px rgba(56,243,255,0.08)',
        }}>
          <div style={{
            color:         TYPE_CSS_COLOR[selectedEvent.type] ?? 'var(--accent-cyan)',
            fontSize:      '13px',
            fontWeight:    'bold',
            marginBottom:  '10px',
            letterSpacing: '0.12em',
          }}>
            ◉ EVENT INTERCEPT
          </div>

          <div>
            <span style={{ color: 'var(--text-label)' }}>Type:&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span style={{
              color:      TYPE_CSS_COLOR[selectedEvent.type] ?? 'var(--accent-cyan)',
              fontWeight: 'bold',
            }}>
              {TYPE_LABELS[selectedEvent.type] ?? selectedEvent.type.toUpperCase()}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--text-label)' }}>Intensity: </span>
            <span style={{ color: 'var(--text-primary)' }}>{selectedEvent.intensity}/10</span>
          </div>

          <div>
            <span style={{ color: 'var(--text-label)' }}>Grid:&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {Math.abs(selectedEvent.lat).toFixed(4)}°{selectedEvent.lat >= 0 ? 'N' : 'S'},&nbsp;
              {Math.abs(selectedEvent.lng).toFixed(4)}°{selectedEvent.lng >= 0 ? 'E' : 'W'}
            </span>
          </div>

          <div>
            <span style={{ color: 'var(--text-label)' }}>Country:&nbsp;</span>
            <span style={{ color: 'var(--text-primary)' }}>{selectedEvent.country}</span>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <span style={{ color: 'var(--text-label)' }}>Time:&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span style={{ color: 'var(--text-primary)' }}>{formatUTC(selectedEvent.timestamp)}</span>
          </div>

          {selectedEvent.hasAudio && (
            <div style={{ marginBottom: '10px' }}>
              <button
                onClick={() => playAudio(selectedEvent.id)}
                disabled={audioLoading}
                style={{
                  width:           '100%',
                  padding:         '8px',
                  background:      audioPlaying ? 'rgba(255,77,90,0.15)' : 'rgba(56,243,255,0.1)',
                  border:          `1px solid ${audioPlaying ? 'rgba(255,77,90,0.4)' : 'rgba(56,243,255,0.3)'}`,
                  borderRadius:    '4px',
                  color:           audioPlaying ? '#ff4d5a' : '#38f3ff',
                  fontFamily:      'monospace',
                  fontSize:        '11px',
                  fontWeight:      'bold',
                  letterSpacing:   '0.12em',
                  cursor:          audioLoading ? 'wait' : 'pointer',
                }}
              >
                {audioLoading ? '⏳ LOADING...' : audioPlaying ? '⏹ STOP PLAYBACK' : '🔊 PLAY FART AUDIO'}
              </button>
            </div>
          )}

          <div style={{
            borderTop:     '1px solid rgba(56,243,255,0.12)',
            paddingTop:    '8px',
            color:         'var(--text-label)',
            marginBottom:  '4px',
            letterSpacing: '0.1em',
          }}>
            ANALYST NOTE:
          </div>
          <div style={{ color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: '1.5' }}>
            "{analystNote.current}"
          </div>

          <div
            onClick={() => {
              setSelectedEvent(null)
              if (globeRef.current) globeRef.current.controls().autoRotate = true
            }}
            style={{
              marginTop:     '12px',
              color:         'rgba(56,243,255,0.45)',
              cursor:        'pointer',
              fontSize:      '10px',
              letterSpacing: '0.15em',
              textAlign:     'center',
            }}
          >
            [CLICK TO DISMISS]
          </div>
        </div>
      )}
    </div>
  )
}
