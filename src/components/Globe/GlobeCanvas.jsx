import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import Globe from 'globe.gl'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { classifyEmission, generatePayloadDescription } from '../../config/humor.ts'

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

const RISE_SPEED = {
  standard:           0.015,
  epic:               0.020,
  'silent-but-deadly': 0.008,
}

const PUFF_LIFETIME_MS = 5000

// ── Puff helpers ─────────────────────────────────────────────────────────────

function makePuffMesh(event) {
  const hasAudio = !!event.hasAudio

  // Volume-based sizing when available, fallback to intensity
  const vol = event.volume || event.intensity * 5
  let baseRadius = 0.25 + vol * 0.025

  // Audio events are larger and more visible
  if (hasAudio) baseRadius *= 1.5

  // Cloud-like geometry: perturb vertices for lumpy shape
  const geometry = new THREE.SphereGeometry(baseRadius, 10, 8)
  const positions = geometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    const noise = 1 + (Math.sin(x * 5.3 + i) * Math.cos(y * 4.1 + i) * 0.3)
    positions.setXYZ(i, x * noise, y * noise, z * noise)
  }
  geometry.attributes.position.needsUpdate = true
  geometry.computeVertexNormals()

  const color = new THREE.Color(CLOUD_COLOR_HEX[event.type] ?? CLOUD_COLOR_HEX.standard)
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: hasAudio ? 0.7 : 0.4,
    transparent: true,
    opacity: event.type === 'epic' ? 0.9 : 0.72,
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


// ── Component ────────────────────────────────────────────────────────────────

const GlobeCanvasInner = forwardRef(function GlobeCanvas({ events }, ref) {
  const mountRef   = useRef(null)
  const globeRef   = useRef(null)
  const puffsRef   = useRef([])
  const layerTimer = useRef(null)
  const puffTimer  = useRef(null)
  const prevCount  = useRef(0)

  const [selectedEvent, setSelectedEvent] = useState(null)
  const selectedEventRef = useRef(null) // ref for hover callbacks (avoids stale closure)

  // Audio playback state
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)
  const audioRef = useRef(null)

  // Expose methods via ref for parent
  useImperativeHandle(ref, () => ({
    flyTo: ({ lat, lng, altitude = 1.8 }) => {
      if (globeRef.current) {
        globeRef.current.pointOfView({ lat, lng, altitude }, 1200)
        globeRef.current.controls().autoRotate = false
      }
    },
    toggleAutoRotate: () => {
      if (globeRef.current) {
        const controls = globeRef.current.controls()
        controls.autoRotate = !controls.autoRotate
        return controls.autoRotate
      }
      return false
    },
    getAutoRotate: () => {
      return globeRef.current?.controls()?.autoRotate ?? false
    },
  }), [])

  // Keep ref in sync with state (for globe hover callbacks)
  useEffect(() => {
    selectedEventRef.current = selectedEvent
  }, [selectedEvent])

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

      // ── Rising cloud puffs ────────────────────────────────────────────
      .objectsData([])
      .objectLat('lat')
      .objectLng('lng')
      .objectAltitude(d => getPuffAltitude(d))
      .objectThreeObject(d => {
        if (!d._mesh) d._mesh = makePuffMesh(d)
        return d._mesh
      })
      .onObjectClick(obj => {
        setSelectedEvent(obj)
        g.controls().autoRotate = false
        g.pointOfView({ lat: obj.lat, lng: obj.lng, altitude: 1.8 }, 800)
      })
      .onObjectHover(obj => {
        if (obj) {
          g.controls().autoRotate = false
        } else if (!selectedEventRef.current) {
          g.controls().autoRotate = true
        }
      })

      // ── Rings — shockwaves ───────────────────────────────────────────
      .ringsData([])
      .ringLat('lat')
      .ringLng('lng')
      .ringColor(d => RING_COLOR_FN[d.type] ?? RING_COLOR_FN.standard)
      .ringMaxRadius(d => 2.5 + d.intensity * 0.6)
      .ringPropagationSpeed(2.5)
      .ringRepeatPeriod(1400)
      .ringAltitude(0.003)

      // ── Points — ground-level location markers ────────────────────────
      .pointsData([])
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.012)
      .pointRadius(d => {
        const base = 0.25 + d.intensity * 0.06
        return d.hasAudio ? base * 1.5 : base
      })
      .pointColor(d => POINT_COLORS[d.type] ?? POINT_COLORS.standard)
      .pointsMerge(false)
      .pointsTransitionDuration(300)
      .onPointClick(point => {
        setSelectedEvent(point)
        g.controls().autoRotate = false
        g.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.8 }, 800)
      })
      .onPointHover(point => {
        if (point) {
          g.controls().autoRotate = false
        } else if (!selectedEventRef.current) {
          g.controls().autoRotate = true
        }
      })

      // ── HexBin density columns ────────────────────────────────────────
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

    // ── UnrealBloomPass ──────────────────────────────────────────────
    const renderer = g.renderer()
    const scene    = g.scene()
    const camera   = g.camera()

    // Add ambient light so MeshStandardMaterial is visible
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.75,
      0.4,
      0.65
    )
    composer.addPass(bloomPass)

    let composerActive = false
    const _render = renderer.render.bind(renderer)
    renderer.render = (sc, cam) => {
      if (composerActive) return _render(sc, cam)
      composerActive = true
      composer.render()
      composerActive = false
    }

    // ── Puff animation loop ──────────────────────────────────────────
    puffTimer.current = setInterval(() => {
      const now = Date.now()

      puffsRef.current = puffsRef.current.filter(
        p => now - p._birthTime < PUFF_LIFETIME_MS
      )

      for (const p of puffsRef.current) {
        if (p._mesh) {
          p._mesh.material.opacity = getPuffOpacity(p)
          const ageFrac = (now - p._birthTime) / PUFF_LIFETIME_MS
          p._mesh.scale.setScalar(1 + ageFrac * 0.7)
        }
      }

      if (globeRef.current) {
        globeRef.current.objectsData([...puffsRef.current])
      }
    }, 50)

    // Resize handler
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
      renderer.render = _render
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
      const newPuffs = newEvents.map(e => ({
        ...e,
        _birthTime: Date.now(),
        _mesh: null,
      }))
      puffsRef.current = [...newPuffs, ...puffsRef.current].slice(0, 60)

      // Rings for ALL events
      const stamped = newEvents.map(e => ({ ...e, _ts: Date.now() }))
      const alive   = g.ringsData().filter(r => Date.now() - r._ts < 10000)
      g.ringsData([...stamped, ...alive].slice(0, 40))
    }

    // Throttled: points + hexbin + labels
    clearTimeout(layerTimer.current)
    layerTimer.current = setTimeout(() => {
      const now    = Date.now()
      const recent = events.filter(e => now - e.timestamp < 90_000)
      g.pointsData(recent.slice(0, 200))
      g.hexBinPointsData(events.filter(e => now - e.timestamp < 600_000))
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
      // silently fail
    } finally {
      setAudioLoading(false)
    }
  }

  // ── Escape key → dismiss overlay ───────────────────────────────────────
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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      />

      {selectedEvent && (() => {
        const cls = classifyEmission(selectedEvent.duration, selectedEvent.volume)
        const FLAG_MAP = {
          US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', JP:'🇯🇵', CN:'🇨🇳',
          BR:'🇧🇷', IN:'🇮🇳', AU:'🇦🇺', CA:'🇨🇦', MX:'🇲🇽', RU:'🇷🇺',
          NG:'🇳🇬', ZA:'🇿🇦', EG:'🇪🇬', AR:'🇦🇷', KR:'🇰🇷', ID:'🇮🇩',
          TR:'🇹🇷', IT:'🇮🇹',
        }
        const flag = FLAG_MAP[selectedEvent.country] || '🌍'
        const relTime = (() => {
          const sec = Math.max(0, Math.floor((Date.now() - selectedEvent.timestamp) / 1000))
          if (sec < 60) return `${sec}s ago`
          if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
          return `${Math.floor(sec / 3600)}h ago`
        })()

        return (
          <div style={{
            position:         'absolute',
            top:              '50%',
            right:            '20px',
            transform:        'translateY(-50%)',
            background:       'rgba(8,14,22,0.94)',
            backdropFilter:   'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border:           `1px solid ${cls.color}33`,
            borderRadius:     '8px',
            minWidth:         '280px',
            maxWidth:         '320px',
            fontFamily:       'monospace',
            fontSize:         '12px',
            lineHeight:       '1.5',
            zIndex:           100,
            boxShadow:        `0 8px 40px rgba(0,0,0,0.6), 0 0 20px ${cls.color}15`,
            animation:        'overlaySlideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
            overflow:         'hidden',
          }}>
            {/* Top accent strip */}
            <div style={{
              height: '3px',
              background: `linear-gradient(90deg, transparent, ${cls.color}, transparent)`,
              opacity: 0.7,
            }} />

            {/* Classification header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px 12px',
              background: `linear-gradient(180deg, ${cls.color}0a, transparent)`,
              borderBottom: `1px solid ${cls.color}22`,
            }}>
              <span style={{ fontSize: '28px' }}>{flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{
                    fontSize: '14px', fontWeight: 'bold', color: cls.color,
                    letterSpacing: '0.1em',
                    textShadow: `0 0 10px ${cls.color}55`,
                  }}>{cls.label.toUpperCase()}</span>
                  <span style={{
                    fontSize: '7px', padding: '2px 5px', borderRadius: '3px',
                    background: `${cls.color}18`, border: `1px solid ${cls.color}33`,
                    color: cls.color, fontWeight: 'bold', letterSpacing: '0.12em',
                  }}>{cls.code}</span>
                </div>
                <div style={{
                  fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.04em',
                }}>
                  {selectedEvent.country} {relTime}
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{
              fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic',
              lineHeight: 1.5, padding: '10px 16px',
              borderBottom: '1px solid rgba(56,243,255,0.06)',
            }}>
              {cls.description}
            </div>

            {/* Stats grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: selectedEvent.volume != null ? '1fr 1fr 1fr' : '1fr 1fr',
              gap: '1px',
              background: 'rgba(56,243,255,0.06)',
              margin: '0',
            }}>
              {/* Duration */}
              <div style={{
                padding: '10px 12px',
                background: 'rgba(8,14,22,0.9)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '7px', letterSpacing: '0.2em', color: 'var(--text-dim)',
                  textTransform: 'uppercase', marginBottom: '3px',
                }}>DURATION</div>
                <div style={{
                  fontSize: '16px', fontWeight: 'bold', color: '#38f3ff',
                  textShadow: '0 0 8px rgba(56,243,255,0.3)',
                }}>
                  {selectedEvent.duration != null ? `${selectedEvent.duration}s` : '—'}
                </div>
              </div>

              {/* Volume */}
              {selectedEvent.volume != null && (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(8,14,22,0.9)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: '7px', letterSpacing: '0.2em', color: 'var(--text-dim)',
                    textTransform: 'uppercase', marginBottom: '3px',
                  }}>VOLUME</div>
                  <div style={{
                    fontSize: '16px', fontWeight: 'bold',
                    color: selectedEvent.volume > 40 ? '#ff4d5a' : selectedEvent.volume > 20 ? '#ffb020' : '#38f3ff',
                    textShadow: selectedEvent.volume > 40
                      ? '0 0 8px rgba(255,77,90,0.4)'
                      : '0 0 8px rgba(56,243,255,0.3)',
                  }}>
                    {selectedEvent.volume}
                  </div>
                </div>
              )}

              {/* Coordinates */}
              <div style={{
                padding: '10px 12px',
                background: 'rgba(8,14,22,0.9)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '7px', letterSpacing: '0.2em', color: 'var(--text-dim)',
                  textTransform: 'uppercase', marginBottom: '3px',
                }}>POSITION</div>
                <div style={{
                  fontSize: '9px', color: 'var(--text-primary)', letterSpacing: '0.03em',
                  lineHeight: 1.6,
                }}>
                  {Math.abs(selectedEvent.lat).toFixed(2)}{'\u00B0'}{selectedEvent.lat >= 0 ? 'N' : 'S'}
                  <br />
                  {Math.abs(selectedEvent.lng).toFixed(2)}{'\u00B0'}{selectedEvent.lng >= 0 ? 'E' : 'W'}
                </div>
              </div>
            </div>

            {/* Visual volume meter */}
            {selectedEvent.volume != null && (
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid rgba(56,243,255,0.06)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{
                    fontSize: '7px', color: 'var(--text-dim)', letterSpacing: '0.15em',
                    width: '42px', textTransform: 'uppercase',
                  }}>Volume</span>
                  <div style={{
                    flex: 1, height: '6px', borderRadius: '3px',
                    background: 'rgba(56,243,255,0.08)',
                    border: '1px solid rgba(56,243,255,0.08)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min((selectedEvent.volume / 60) * 100, 100)}%`,
                      height: '100%',
                      borderRadius: '2px',
                      background: selectedEvent.volume > 40
                        ? 'linear-gradient(90deg, #38f3ff, #ff4d5a)'
                        : selectedEvent.volume > 20
                          ? 'linear-gradient(90deg, #38f3ff, #ffb020)'
                          : '#38f3ff',
                      boxShadow: selectedEvent.volume > 30
                        ? '0 0 6px rgba(255,77,90,0.4)'
                        : '0 0 4px rgba(56,243,255,0.3)',
                      transition: 'width 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                    }} />
                  </div>
                </div>

                {selectedEvent.peakVolume != null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginTop: '6px',
                  }}>
                    <span style={{
                      fontSize: '7px', color: 'var(--text-dim)', letterSpacing: '0.15em',
                      width: '42px', textTransform: 'uppercase',
                    }}>Peak</span>
                    <div style={{
                      flex: 1, height: '4px', borderRadius: '2px',
                      background: 'rgba(255,77,90,0.06)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min((selectedEvent.peakVolume / 80) * 100, 100)}%`,
                        height: '100%',
                        borderRadius: '2px',
                        background: 'linear-gradient(90deg, #ff4d5a88, #ff4d5a)',
                        boxShadow: '0 0 4px rgba(255,77,90,0.3)',
                        transition: 'width 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                      }} />
                    </div>
                    <span style={{
                      fontSize: '8px', color: '#ff4d5a', fontWeight: 'bold',
                      minWidth: '20px', textAlign: 'right',
                    }}>{selectedEvent.peakVolume}</span>
                  </div>
                )}
              </div>
            )}

            {/* Audio section */}
            <div style={{ padding: '10px 16px 12px', borderTop: '1px solid rgba(56,243,255,0.06)' }}>
              {selectedEvent.hasAudio ? (
                <button
                  onClick={() => playAudio(selectedEvent.id)}
                  disabled={audioLoading}
                  style={{
                    width: '100%', padding: '10px',
                    background: audioPlaying ? 'rgba(255,77,90,0.12)' : 'rgba(56,243,255,0.08)',
                    border: `1px solid ${audioPlaying ? 'rgba(255,77,90,0.35)' : 'rgba(56,243,255,0.25)'}`,
                    borderRadius: '5px',
                    color: audioPlaying ? '#ff4d5a' : '#38f3ff',
                    fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold',
                    letterSpacing: '0.12em',
                    cursor: audioLoading ? 'wait' : 'pointer',
                    boxShadow: audioPlaying
                      ? '0 0 12px rgba(255,77,90,0.15)'
                      : '0 0 12px rgba(56,243,255,0.1)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {audioLoading ? '\u23F3 LOADING...' : audioPlaying ? '\u23F9 STOP PLAYBACK' : '\u25B6 PLAY AUDIO'}
                </button>
              ) : (
                <div style={{
                  fontSize: '9px', color: 'rgba(106,122,138,0.4)',
                  fontFamily: 'monospace', letterSpacing: '0.12em',
                  textAlign: 'center',
                  padding: '4px 0',
                }}>
                  NO AUDIO CAPTURED
                </div>
              )}
            </div>

            {/* Dismiss */}
            <div
              onClick={() => {
                setSelectedEvent(null)
                if (globeRef.current) globeRef.current.controls().autoRotate = true
              }}
              style={{
                padding:        '8px 16px',
                borderTop:      '1px solid rgba(56,243,255,0.06)',
                color:          'rgba(56,243,255,0.35)',
                cursor:         'pointer',
                fontSize:       '8px',
                letterSpacing:  '0.2em',
                textAlign:      'center',
                textTransform:  'uppercase',
                transition:     'color 0.15s ease',
              }}
            >
              ESC TO DISMISS
            </div>
          </div>
        )
      })()}
    </div>
  )
})

export default GlobeCanvasInner
