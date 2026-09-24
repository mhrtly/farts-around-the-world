import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import Globe from 'globe.gl'
import * as THREE from 'three'

// ── Look ────────────────────────────────────────────────────────────────────

const COLOR = {
  fresh: new THREE.Color('#9dff4a'),    // posted in the last hour
  today: new THREE.Color('#ffd35a'),    // posted in the last day
  older: new THREE.Color('#38f3ff'),
  selected: new THREE.Color('#ff64ff'),
}

const WHITE = new THREE.Color('#ffffff')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const MARKER_ALTITUDE = 0.012
const GLOBE_RADIUS = 100

function siteTone(site, now) {
  const age = now - site.latest
  if (age < HOUR) return 'fresh'
  if (age < DAY) return 'today'
  return 'older'
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

function makeRadialTexture(stops) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

let textures = null
function getTextures() {
  if (!textures) {
    textures = {
      glow: makeRadialTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]),
      core: makeRadialTexture([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,1)'], [0.62, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]),
      puff: makeRadialTexture([[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]),
    }
  }
  return textures
}

// Screen-space sprites keep markers the same size at any zoom level.
function makeMarker(site) {
  const { glow, core } = getTextures()
  const group = new THREE.Group()
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow,
    color: COLOR.older,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
  }))
  const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: core,
    color: new THREE.Color('#ffffff'),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
  }))
  glowSprite.renderOrder = 10
  coreSprite.renderOrder = 11
  group.add(glowSprite)
  group.add(coreSprite)
  group.userData = { site, glowSprite, coreSprite, phase: Math.random() * Math.PI * 2 }
  return group
}

// ── Component ───────────────────────────────────────────────────────────────

const GlobeCanvas = forwardRef(function GlobeCanvas({
  sites,
  selectedKey = null,
  compact = false,
  offsetX = 0,
  offsetY = 0,
  paused = false,
  onSiteSelect,
  onBackgroundClick,
  onReady,
}, ref) {
  const mountRef = useRef(null)
  const globeRef = useRef(null)
  const markersRef = useRef(new Map()) // site key → { site, object }
  const puffsRef = useRef([])
  const burstsRef = useRef([])
  const selectedKeyRef = useRef(selectedKey)
  const highlightKeyRef = useRef(null)
  const callbacksRef = useRef({ onSiteSelect, onBackgroundClick, onReady })
  const resumeTimerRef = useRef(null)
  const interactingRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })

  callbacksRef.current = { onSiteSelect, onBackgroundClick, onReady }

  useImperativeHandle(ref, () => ({
    flyTo({ lat, lng, altitude }, ms = 1100) {
      const g = globeRef.current
      if (!g) return
      stopAutoRotate()
      const pov = g.pointOfView()
      g.pointOfView({ lat, lng, altitude: altitude ?? Math.min(pov.altitude, compact ? 1.6 : 1.4) }, ms)
    },
    burst(lat, lng, { color = '#9dff4a', big = false } = {}) {
      spawnBurst(lat, lng, color, big)
    },
    // Light up a place while its row is hovered in the list (null to clear)
    highlight(key) {
      if (highlightKeyRef.current === key) return
      highlightKeyRef.current = key
      updateRings()
    },
    resumeAutoRotate() {
      scheduleAutoRotate(0)
    },
    stopAutoRotate() {
      stopAutoRotate()
    },
  }), [compact])

  function stopAutoRotate() {
    clearTimeout(resumeTimerRef.current)
    const g = globeRef.current
    if (g) g.controls().autoRotate = false
  }

  function scheduleAutoRotate(delay = 12000) {
    clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      const g = globeRef.current
      if (!g || selectedKeyRef.current || interactingRef.current) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      g.controls().autoRotate = true
    }, delay)
  }

  function spawnBurst(lat, lng, color, big) {
    const g = globeRef.current
    if (!g) return
    const { puff } = getTextures()
    const count = big ? 7 : 4
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: puff,
        color: new THREE.Color(color),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }))
      sprite.renderOrder = 12
      g.scene().add(sprite)
      puffsRef.current.push({
        sprite,
        lat: lat + (Math.random() - 0.5) * 0.8,
        lng: lng + (Math.random() - 0.5) * 0.8,
        born: performance.now() + i * 140,
        life: (big ? 3600 : 2600) + Math.random() * 600,
        size: (big ? 7 : 4.5) + Math.random() * 2.5,
      })
    }
    const ring = { lat, lng, color, burst: true, until: Date.now() + (big ? 4200 : 2600), big }
    burstsRef.current = [...burstsRef.current, ring]
    updateRings()
    setTimeout(() => {
      burstsRef.current = burstsRef.current.filter(r => r !== ring)
      updateRings()
    }, big ? 4300 : 2700)
  }

  function updateRings() {
    const g = globeRef.current
    if (!g) return
    const now = Date.now()
    const rings = []
    for (const { site } of markersRef.current.values()) {
      if (site.key === selectedKeyRef.current) {
        rings.push({ lat: site.lat, lng: site.lng, color: '#ff64ff', speed: 1.4, max: 3.2, period: 1500 })
      } else if (site.key === highlightKeyRef.current) {
        rings.push({ lat: site.lat, lng: site.lng, color: '#38f3ff', speed: 2.2, max: 3.6, period: 800 })
      } else if (now - site.latest < HOUR) {
        rings.push({ lat: site.lat, lng: site.lng, color: '#9dff4a', speed: 1.1, max: 2.4, period: 2200 })
      }
    }
    for (const burst of burstsRef.current) {
      rings.push({ lat: burst.lat, lng: burst.lng, color: burst.color, speed: burst.big ? 5 : 3.5, max: burst.big ? 9 : 5, period: burst.big ? 700 : 900 })
    }
    g.ringsData(rings)
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    const isSmall = window.innerWidth < 860
    const g = new Globe(mount, {
      rendererConfig: { antialias: !isSmall, alpha: true, powerPreference: 'high-performance' },
      animateIn: true,
    })
    globeRef.current = g
    if (import.meta.env.DEV) window.__fatwGlobe = g // handy in the console while developing

    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.75 : 2))

    g
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl(isSmall ? '/textures/earth-night-2k.jpg' : '/textures/earth-night-4k.jpg')
      .showAtmosphere(true)
      .atmosphereColor('#4cc9ff')
      .atmosphereAltitude(0.16)
      .showPointerCursor((type) => type === 'object')
      .onGlobeReady(() => callbacksRef.current.onReady?.())

      // Sites: one glowing marker per place
      .objectsData([])
      .objectLat('lat')
      .objectLng('lng')
      .objectAltitude(MARKER_ALTITUDE)
      .objectFacesSurface(false)
      .objectThreeObject(site => {
        const entry = markersRef.current.get(site.key)
        if (entry?.object) return entry.object
        const object = makeMarker(site)
        if (entry) entry.object = object
        return object
      })
      .objectLabel(site => {
        const count = site.events.length
        const name = site.place ? site.place.split(',')[0] : 'Unnamed spot'
        return `<div class="globe-tooltip"><strong>${escapeHtml(name)}</strong><span>${count} fart${count === 1 ? '' : 's'}</span></div>`
      })
      .onObjectClick(site => {
        callbacksRef.current.onSiteSelect?.(site.key)
      })
      .onObjectHover(site => {
        // Hold still while someone is aiming at a marker
        if (site) stopAutoRotate()
        else scheduleAutoRotate(5000)
      })
      .pointerEventsFilter((object, data) => {
        // Ignore markers on the far side of the planet
        if (data && data.key && markersRef.current.has(data.key)) {
          return markersRef.current.get(data.key).facing !== false
        }
        return true
      })

      // Pulses for fresh sites, the selected site, and new arrivals
      .ringsData([])
      .ringLat('lat')
      .ringLng('lng')
      .ringColor(d => {
        const c = new THREE.Color(d.color)
        const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
        return t => `rgba(${rgb},${Math.max(0, 1 - t) * 0.9})`
      })
      .ringMaxRadius('max')
      .ringPropagationSpeed('speed')
      .ringRepeatPeriod('period')
      .ringAltitude(0.004)

      // Forgiving taps: if you miss a marker, pick the nearest visible one
      .onGlobeClick(({ lat, lng }) => {
        const pov = g.pointOfView()
        const threshold = Math.max(0.6, pov.altitude * (window.innerWidth < 860 ? 5.5 : 3.2))
        let best = null
        let bestDistance = Infinity
        for (const entry of markersRef.current.values()) {
          if (entry.facing === false) continue
          const dLat = entry.site.lat - lat
          const dLng = ((entry.site.lng - lng + 540) % 360) - 180
          const distance = Math.sqrt(dLat * dLat + (dLng * Math.cos((lat * Math.PI) / 180)) ** 2)
          if (distance < bestDistance) {
            bestDistance = distance
            best = entry.site
          }
        }
        if (best && bestDistance <= threshold) {
          callbacksRef.current.onSiteSelect?.(best.key)
        } else {
          callbacksRef.current.onBackgroundClick?.()
        }
      })

    const controls = g.controls()
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.autoRotateSpeed = 0.35
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = GLOBE_RADIUS * 1.12
    controls.maxDistance = GLOBE_RADIUS * 6
    controls.rotateSpeed = isSmall ? 0.6 : 0.45
    controls.zoomSpeed = 0.8

    const onStart = () => {
      interactingRef.current = true
      stopAutoRotate()
    }
    const onEnd = () => {
      interactingRef.current = false
      scheduleAutoRotate()
    }
    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)

    g.pointOfView({ lat: 25, lng: -40, altitude: isSmall ? 3.1 : 2.5 }, 0)

    // Per-frame work: marker pulse, far-side culling, puffs, smooth offset
    let frame = 0
    const cameraPos = new THREE.Vector3()
    const markerPos = new THREE.Vector3()
    const tick = (time) => {
      frame = requestAnimationFrame(tick)
      const camera = g.camera()
      cameraPos.copy(camera.position)
      const cameraDistance = cameraPos.length()
      const now = Date.now()
      const small = window.innerWidth < 860

      for (const entry of markersRef.current.values()) {
        const object = entry.object
        if (!object) continue
        const { glowSprite, coreSprite, phase } = object.userData
        object.getWorldPosition(markerPos)
        // Visible if the marker sits on the camera-facing hemisphere
        const facing = markerPos.dot(cameraPos) / (markerPos.length() * cameraDistance) > (GLOBE_RADIUS * 1.01) / cameraDistance
        entry.facing = facing
        object.visible = facing

        const selected = entry.site.key === selectedKeyRef.current
        const tone = selected ? 'selected' : siteTone(entry.site, now)
        glowSprite.material.color.copy(COLOR[tone])
        const countBoost = Math.min(1.9, 1 + Math.log2(entry.site.events.length) * 0.22)
        const pulse = tone === 'older' ? 0.06 : 0.16
        const breathe = 1 + Math.sin(time / (tone === 'fresh' ? 380 : 900) + phase) * pulse
        const highlighted = entry.site.key === highlightKeyRef.current
        const base = (small ? 0.05 : 0.036) * countBoost * (selected ? 1.35 : highlighted ? 1.3 : 1)
        glowSprite.scale.setScalar(base * breathe)
        coreSprite.scale.setScalar(base * 0.26)
        coreSprite.material.color.copy(selected ? COLOR.selected : COLOR[tone]).lerp(WHITE, 0.55)
        glowSprite.material.opacity = selected ? 1 : 0.85
      }

      if (puffsRef.current.length) {
        const nowPerf = performance.now()
        puffsRef.current = puffsRef.current.filter(puff => {
          const age = nowPerf - puff.born
          if (age < 0) return true
          const t = age / puff.life
          if (t >= 1) {
            g.scene().remove(puff.sprite)
            puff.sprite.material.dispose()
            return false
          }
          const coords = g.getCoords(puff.lat, puff.lng, 0.01 + t * 0.14)
          puff.sprite.position.set(coords.x, coords.y, coords.z)
          puff.sprite.scale.setScalar(puff.size * (0.5 + t * 1.4))
          puff.sprite.material.opacity = Math.sin(Math.min(1, t * 3) * Math.PI / 2) * (1 - t) * 0.7
          return true
        })
      }

      // Glide the globe out from under panels and sheets
      const offset = offsetRef.current
      const dx = offset.targetX - offset.x
      const dy = offset.targetY - offset.y
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        offset.x += dx * 0.12
        offset.y += dy * 0.12
        g.globeOffset([offset.x, offset.y])
      } else if (dx !== 0 || dy !== 0) {
        offset.x = offset.targetX
        offset.y = offset.targetY
        g.globeOffset([offset.x, offset.y])
      }
    }
    frame = requestAnimationFrame(tick)

    const resize = () => {
      g.width(mount.clientWidth)
      g.height(mount.clientHeight)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    const onVisibility = () => {
      if (document.hidden) g.pauseAnimation()
      else g.resumeAnimation()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const ringTimer = setInterval(updateRings, 60 * 1000)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(resumeTimerRef.current)
      clearInterval(ringTimer)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
      for (const puff of puffsRef.current) puff.sprite.material.dispose()
      puffsRef.current = []
      markersRef.current = new Map()
      g._destructor?.()
      mount.innerHTML = ''
      globeRef.current = null
    }
  }, [])

  // ── Sites → markers (stable objects; only re-digest when the set changes) ──
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const markers = markersRef.current
    const nextKeys = new Set(sites.map(site => site.key))
    let changed = false

    for (const key of [...markers.keys()]) {
      if (!nextKeys.has(key)) {
        markers.delete(key)
        changed = true
      }
    }
    for (const site of sites) {
      const entry = markers.get(site.key)
      if (entry) {
        // Keep the same data object so globe.gl keeps the same marker
        Object.assign(entry.site, site)
      } else {
        markers.set(site.key, { site: { ...site }, object: null, facing: true })
        changed = true
      }
    }
    if (changed) {
      g.objectsData([...markers.values()].map(entry => entry.site))
    }
    updateRings()
  }, [sites])

  // ── Selection ───────────────────────────────────────────────────────────
  useEffect(() => {
    selectedKeyRef.current = selectedKey
    if (selectedKey) stopAutoRotate()
    else scheduleAutoRotate(6000)
    updateRings()
  }, [selectedKey])

  useEffect(() => {
    offsetRef.current.targetX = offsetX
    offsetRef.current.targetY = offsetY
  }, [offsetX, offsetY])

  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    if (paused) g.pauseAnimation()
    else g.resumeAnimation()
  }, [paused])

  return <div ref={mountRef} className="globe-mount" />
})

export default GlobeCanvas
