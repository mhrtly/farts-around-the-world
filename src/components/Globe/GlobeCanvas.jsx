import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import Globe from 'globe.gl'
import * as THREE from 'three'
import { currentLevel, currentTime, playbackEnvelope, playingId } from '../../utils/player.js'
import { formatCoords, siteKey, volumeToDb } from '../../utils/recordings.js'
import {
  GLOBE_RADIUS,
  TAN_HALF_FOV,
  arcDegrees,
  clamp,
  damp,
  easeInCubic,
  easeOutCubic,
  rgb,
  toLatLng,
  toVector,
} from './geo.js'
import { applyPhosphorLook, loadGlobeTexture, makeGraticule, makeStarfield } from './look.js'
import { MarkerLayer, coreSize } from './markers.js'
import { RingPool } from './rings.js'
import { GlowPool } from './glows.js'
import { Reticle } from './reticle.js'
import { CameraRig } from './camera.js'

const PHOSPHOR = rgb('#62f6d0')
const SODIUM = rgb('#ffa537')
const SODIUM_HOT = [1, 0.86, 0.62]
const GRATICULE_OPACITY = 0.06
const DAMPING = 0.08 // per 60 Hz frame; scaled by the real frame time

// The loud moments of a recording (≤ 6, ≥ 220 ms apart) from its playback
// waveform, so the dot can pulse exactly when the fart does.
function peakSchedule({ peaks, start, end }) {
  const n = peaks?.length || 0
  const span = end - start
  if (n < 3 || !(span > 0)) return []
  const candidates = []
  for (let i = 0; i < n; i++) {
    const value = peaks[i]
    if (value < 0.42) continue
    if ((i > 0 && peaks[i - 1] > value) || (i < n - 1 && peaks[i + 1] >= value)) continue
    candidates.push({ value, time: start + (i / (n - 1)) * span })
  }
  candidates.sort((a, b) => b.value - a.value)
  const picked = []
  for (const candidate of candidates) {
    if (picked.length >= 6) break
    if (picked.every(other => Math.abs(other.time - candidate.time) >= 0.22)) picked.push(candidate)
  }
  if (picked.length) picked[0].loudest = true
  return picked.sort((a, b) => a.time - b.time).map(peak => ({ ...peak, fired: false }))
}

const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function tipText(site) {
  const place = site.place ? site.place.split(',')[0].trim() : formatCoords(site.lat, site.lng)
  return `${place} · ${site.events.length}`.toUpperCase()
}

const GlobeCanvas = forwardRef(function GlobeCanvas({
  sites,
  selectedKey = null,
  playingKey = null,
  compact = false,
  offsetX = 0,
  offsetY = 0,
  paused = false,
  dimmed = false,
  onSiteSelect,
  onBackgroundClick,
  onReady,
  onWarmupDone,
}, ref) {
  const mountRef = useRef(null)
  const tipRef = useRef(null)
  const engineRef = useRef(null)
  const extraSitesRef = useRef([]) // development only: stand-in places for density tests
  const propsRef = useRef(null)
  propsRef.current = { sites, selectedKey, playingKey, compact, dimmed, paused, offsetX, offsetY, onSiteSelect, onBackgroundClick, onReady, onWarmupDone }

  // A stable handle; each call goes to whichever engine is mounted.
  const apiRef = useRef(null)
  if (!apiRef.current) {
    const engine = () => engineRef.current
    apiRef.current = {
      flyTo: (target, options) => engine()?.flyTo(target, options) || Promise.resolve(false),
      frameAll: ms => engine()?.frameAll(ms) || Promise.resolve(false),
      burst: (lat, lng, options) => engine()?.burst(lat, lng, options),
      land: (lat, lng) => engine()?.land(lat, lng) || Promise.resolve(),
      highlight: key => engine()?.highlight(key),
      warmUp: () => engine()?.warmUp(),
      resumeAutoRotate: () => engine()?.scheduleAutoRotate(0),
      stopAutoRotate: () => engine()?.stopAutoRotate(),
      screenPoint: (lat, lng) => engine()?.screenPoint(lat, lng) || { x: window.innerWidth / 2, y: window.innerHeight / 2, visible: false },
    }
  }
  useImperativeHandle(ref, () => apiRef.current, [])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    const tip = tipRef.current
    if (!mount) return undefined
    const phoneAtStart = propsRef.current.compact
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = reducedQuery.matches
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    let disposed = false

    const g = new Globe(mount, {
      rendererConfig: { antialias: !phoneAtStart, alpha: true, powerPreference: 'default' },
      animateIn: false,
    })
    // Our frame work (camera, markers) has to run just before globe.gl renders,
    // so our loop is registered first and globe.gl's loop after it.
    g.pauseAnimation()

    const renderer = g.renderer()
    const pixelRatio = Math.min(window.devicePixelRatio || 1, phoneAtStart ? 1.75 : 2)
    renderer.setPixelRatio(pixelRatio)
    const scene = g.scene()
    const camera = g.camera()
    const controls = g.controls()

    const uniforms = { uWarm: { value: reduced ? 1 : 0 } }
    applyPhosphorLook(g.globeMaterial(), uniforms)

    const size = { w: mount.clientWidth || window.innerWidth, h: mount.clientHeight || window.innerHeight, left: 0, top: 0 }
    const stars = makeStarfield(phoneAtStart ? 900 : 1600, pixelRatio)
    const graticule = makeGraticule(15)
    const markers = new MarkerLayer(pixelRatio)
    const rings = new RingPool(32)
    const glows = new GlowPool(128, pixelRatio)
    const reticle = new Reticle(pixelRatio)
    const rig = new CameraRig(g)
    rig.pause(performance.now()) // until the first frame renders
    scene.add(stars, graticule, markers.points, rings.group, glows.points, reticle.points)
    if (reduced) graticule.material.opacity = GRATICULE_OPACITY

    const state = {
      running: false,
      hoverKey: null,
      highlightKey: null,
      nextHighlightRing: 0,
      tap: null, // { key, at } — shown selected until App confirms
      lockedKey: null,
      offset: { x: propsRef.current.offsetX, y: propsRef.current.offsetY, tx: propsRef.current.offsetX, ty: propsRef.current.offsetY },
      landings: new Map(), // site key → impact time, for places that don't exist yet
      eventsById: new Map(),
      audio: { id: null, schedule: null, lastT: -1, level: 0, event: null, startedAt: 0 },
      warm: { started: false, done: false, t0: 0, ramp: 1600, end: 0, fast: false },
      pausedAt: performance.now(), // not rendering yet
      pendingMap: null, // the sharper texture, waiting for a still moment
      dimmed: false,
    }
    const timers = {}

    g
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl('/textures/earth-night-1k.jpg')
      .showAtmosphere(true)
      .atmosphereColor('#2c8a7e')
      .atmosphereAltitude(0.11)
      .enablePointerInteraction(false) // taps and hover are ours (screen-space picking)
      .showPointerCursor(false)
      .onGlobeReady(() => {
        const map = g.globeMaterial().map
        if (map) {
          map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
          map.needsUpdate = true
        }
        propsRef.current.onReady?.()
        // If nobody starts the warm-up (no splash, an error upstream), do it anyway
        timers.warmSafety = setTimeout(() => warmUp(), 9000)
      })
    g.globeOffset([state.offset.x, state.offset.y])

    controls.autoRotate = false
    controls.autoRotateSpeed = 0.35
    controls.enableDamping = true
    controls.dampingFactor = DAMPING
    // Closer than this the night texture is mush
    controls.minDistance = GLOBE_RADIUS * (phoneAtStart ? 1.3 : 1.22)
    controls.maxDistance = GLOBE_RADIUS * 6

    // Parked just off the data until the splash lifts; frameAll() glides in.
    g.pointOfView({ lat: 24, lng: -58, altitude: phoneAtStart ? 3.4 : 3 }, 0)

    // ── Auto-rotate ────────────────────────────────────────────────────────
    let interacting = false
    function stopAutoRotate() {
      clearTimeout(timers.rotate)
      controls.autoRotate = false
    }
    function scheduleAutoRotate(delay = 12000) {
      clearTimeout(timers.rotate)
      timers.rotate = setTimeout(() => {
        if (disposed || reduced || interacting || propsRef.current.selectedKey || state.hoverKey) return
        controls.autoRotate = true
      }, delay)
    }
    const onControlsStart = () => {
      interacting = true
      stopAutoRotate()
    }
    const onControlsEnd = () => {
      interacting = false
      if (!propsRef.current.selectedKey) scheduleAutoRotate()
    }
    controls.addEventListener('start', onControlsStart)
    controls.addEventListener('end', onControlsEnd)

    // ── Sites ──────────────────────────────────────────────────────────────
    function setSites(list) {
      const added = markers.setSites(list)
      state.eventsById = new Map()
      for (const site of list) for (const event of site.events) state.eventsById.set(event.id, event)
      const now = performance.now()
      for (const entry of added) {
        const impact = state.landings.get(entry.key)
        if (impact) {
          entry.bornAt = impact
          entry.flashAt = impact
        } else if (state.warm.done) {
          // A new place: stays dark for a moment in case its arrival is about to
          // be announced (land() for our own post, burst() for a live one), so
          // the dot switches on with its effect rather than before it.
          entry.bornAt = now + 1700
          entry.flashAt = entry.bornAt
        } else if (state.warm.started) {
          entry.bornAt = Math.max(now, state.warm.end)
          entry.flashAt = entry.bornAt
        }
      }
    }

    // ── Warm-up: the instrument switches on ───────────────────────────────
    // Called as the splash starts to fade; the cities wait until it's mostly
    // gone (~380 ms), so the switch-on happens on a clear screen.
    function warmUp() {
      const warm = state.warm
      if (warm.started || disposed) return
      clearTimeout(timers.warmSafety)
      const now = performance.now()
      warm.started = true
      // A shared link is about one fart: a quicker switch-on
      warm.fast = /^\/r\//.test(window.location.pathname)
      warm.t0 = now + (reduced ? 0 : warm.fast ? 150 : 380)
      warm.ramp = warm.fast ? 900 : 1600
      const order = [...markers.entries].sort((a, b) => a.oldest - b.oldest)
      const begin = warm.t0 + (reduced ? 0 : warm.fast ? 200 : 450)
      const span = warm.fast ? 450 : 1100
      const stagger = reduced || order.length < 2 ? 0 : Math.min(warm.fast ? 30 : 70, span / (order.length - 1))
      order.forEach((entry, i) => {
        if (entry.bornAt != null) return
        entry.bornAt = begin + i * stagger
        entry.flashAt = entry.bornAt
        entry.quiet = reduced
      })
      warm.end = begin + Math.max(0, order.length - 1) * stagger
      if (reduced) {
        uniforms.uWarm.value = 1
        graticule.material.opacity = GRATICULE_OPACITY
      }
    }

    function tickWarm(now) {
      const warm = state.warm
      if (!warm.started || warm.done) return
      const t = Math.max(0, now - warm.t0)
      // An even curve: each patch's own random threshold scatters the
      // switch-ons, so they read as streetlights coming on one by one
      const k = reduced ? 1 : clamp(t / warm.ramp, 0, 1)
      uniforms.uWarm.value = k * k * (3 - 2 * k)
      graticule.material.opacity = reduced ? GRATICULE_OPACITY : GRATICULE_OPACITY * clamp((t - (warm.fast ? 100 : 250)) / (warm.fast ? 400 : 900), 0, 1)
      if (k >= 1 && now >= warm.end + 250) {
        warm.done = true
        propsRef.current.onWarmupDone?.()
        timers.texture = setTimeout(upgradeTexture, 300)
      }
    }

    // 1k first (fast first paint), then 2k on phones / 4k on desktop. It's
    // downloaded and decoded in the background, then uploaded and swapped in
    // on a frame when the camera is still, because the upload (a 4k texture
    // is 32 MB of pixels) can cost a frame and would hitch a glide.
    function upgradeTexture() {
      const url = propsRef.current.compact ? '/textures/earth-night-2k.jpg' : '/textures/earth-night-4k.jpg'
      loadGlobeTexture(url, renderer)
        .then(texture => {
          if (disposed) texture.dispose()
          else state.pendingMap = texture
        })
        .catch(() => { /* keep the small texture */ })
    }

    function swapTexture() {
      const texture = state.pendingMap
      state.pendingMap = null
      try { renderer.initTexture(texture) } catch { /* uploads on first use instead */ }
      const material = g.globeMaterial()
      const old = material.map
      material.map = texture
      if (old && old !== texture) old.dispose()
    }

    // ── Camera ─────────────────────────────────────────────────────────────
    // Low enough that the nearest neighbour sits ~44 px away (phones), within
    // sensible limits, and never zooming out from where the user already is.
    function landingAltitude(lat, lng) {
      const phone = propsRef.current.compact
      const lo = phone ? 1.4 : 1
      const hi = phone ? 1.75 : 1.35
      let nearest = Infinity
      for (const entry of markers.entries) {
        const d = arcDegrees(lat, lng, entry.site.lat, entry.site.lng)
        if (d > 0.02 && d < nearest) nearest = d
      }
      const needed = nearest === Infinity ? hi : (0.01872 * size.h * nearest) / (phone ? 44 : 32)
      const current = g.pointOfView().altitude
      // Zoomed in closer than we'd ever land: the user did that on purpose
      // (often to pull apart overlapping dots), so stay there
      if (current < lo) return current
      return clamp(Math.min(current, hi, needed), lo, hi)
    }

    function flyTo(target, options) {
      const opts = typeof options === 'number' ? { ms: options } : (options || {})
      if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return Promise.resolve(false)
      const altitude = Number.isFinite(target.altitude) ? target.altitude : landingAltitude(target.lat, target.lng)
      stopAutoRotate()
      return rig.flyTo({ lat: target.lat, lng: target.lng, altitude }, { ms: opts.ms, style: opts.style || 'push', reduced })
    }

    // Centre on the places' mean direction, high enough that all of them fit
    function frameAll(ms = 2400) {
      const phone = propsRef.current.compact
      const landscape = phone && size.w > size.h
      const entries = markers.entries
      // The establishing glide at reveal waits a beat for the splash to clear
      const intro = state.warm.started && !state.warm.done
      const move = { ms: intro ? Math.max(ms, 2600) : ms, style: 'settle', reduced, delay: intro && !reduced ? 250 : 0 }
      if (!entries.length) {
        return rig.flyTo({ lat: 28, lng: -40, altitude: phone ? 2.6 : 2.3 }, move)
      }
      // Aim at the part of the world with the most places (all of them, when
      // they fit on one side of the planet), not at an average that lands in
      // an empty ocean or on the pole.
      const dirs = entries.map(entry => entry.pos.clone().normalize())
      const mean = dirs.reduce((sum, dir) => sum.add(dir), new THREE.Vector3()).normalize()
      const reach = Math.cos((55 * Math.PI) / 180)
      let best = null
      let bestCount = -1
      let bestAlign = -2
      for (const candidate of [mean, ...dirs]) {
        let count = 0
        for (const dir of dirs) if (dir.dot(candidate) >= reach) count++
        const align = candidate.dot(mean)
        if (count > bestCount || (count === bestCount && align > bestAlign)) {
          best = candidate
          bestCount = count
          bestAlign = align
        }
      }
      // Spread over several continents: rather than an average that drifts
      // toward the pole, show the part of the world with the newest fart
      if (bestCount < dirs.length * 0.6) {
        let newest = 0
        entries.forEach((entry, i) => { if (entry.site.latest > entries[newest].site.latest) newest = i })
        best = dirs[newest]
      }
      const group = dirs.filter(dir => dir.dot(best) >= reach)
      const aim = group.reduce((sum, dir) => sum.add(dir), new THREE.Vector3())
      if (aim.lengthSq() < 1e-6) aim.copy(best)
      const centre = toLatLng(aim)
      let widest = 0
      for (const dir of group) widest = Math.max(widest, (Math.acos(clamp(dir.dot(aim.clone().normalize()), -1, 1)) * 180) / Math.PI)
      const theta = (Math.min(75, widest + 4) * Math.PI) / 180
      const freeW = landscape ? size.w - 220 : phone ? size.w : Math.max(320, size.w - 340)
      const freeH = size.h - (landscape ? 120 : phone ? 220 : 230)
      const k = ((TAN_HALF_FOV * Math.min(freeW, freeH)) / size.h) * 0.76
      const altitude = clamp(Math.cos(theta) + Math.sin(theta) / k - 1, landscape ? 1.6 : phone ? 2 : 1.8, phone ? 3.2 : 2.7)
      // A little south of centre keeps the pale Arctic out of the middle
      const lat = clamp(centre.lat - 4, -35, 40)
      stopAutoRotate()
      return rig.flyTo({ lat, lng: centre.lng, altitude }, move)
    }

    // ── Effects ────────────────────────────────────────────────────────────
    const scale = () => (propsRef.current.compact ? 1 : 0.92)
    const ringWidth = () => (propsRef.current.compact ? 2.6 : 2.1)

    function puffs(lat, lng, color, count, start) {
      for (let i = 0; i < count; i++) {
        const dLat = (Math.random() - 0.5) * 0.5
        const dLng = (Math.random() - 0.5) * 0.5
        const worldSize = 3 + Math.random() * 2
        glows.add({
          start: start + i * 120,
          life: 2200 + Math.random() * 700,
          color,
          at: (t, out) => toVector(lat + dLat * (0.4 + t), lng + dLng * (0.4 + t), 0.01 + t * 0.1, out),
          size: (t, pxPerWorld) => Math.min(90, worldSize * (0.6 + t * 1.6) * pxPerWorld),
          alpha: t => Math.sin(Math.min(1, t * 3) * Math.PI / 2) * (1 - t) * 0.5,
        })
      }
    }

    function burst(lat, lng, { color = '#ffa537', big = false } = {}) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const now = performance.now()
      const c = rgb(color)
      rings.spawn(now, { lat, lng, color: c, from: 4, to: big ? 72 : 46, width: big ? 3.2 : ringWidth(), life: big ? 1500 : 1150, alpha: 0.95 })
      rings.spawn(now, { lat, lng, color: c, from: 3, to: big ? 44 : 28, width: 1.8, life: 1000, alpha: 0.6, delay: 240 })
      puffs(lat, lng, c, big ? 6 : 4, now)
      const entry = markers.get(siteKey(lat, lng))
      if (entry && !entry.lit && entry.bornAt != null) entry.bornAt = now
      if (entry) entry.flashAt = now
    }

    // A new fart arriving from orbit: comet → impact flash → shockwave → the
    // dot switches on. Resolves at impact.
    function land(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve()
      const now = performance.now()
      const fall = reduced ? 0 : 560
      const impact = now + fall
      const key = siteKey(lat, lng)
      state.landings.set(key, impact)
      setTimeout(() => state.landings.delete(key), fall + 8000)
      const entry = markers.get(key)
      if (entry) {
        if (!entry.lit || now - entry.bornAt < 4000) {
          entry.bornAt = impact // new (or only just appeared): dark until the hit
          entry.lit = false
        }
        entry.flashAt = impact
      }
      const site = toVector(lat, lng, 0.006)
      if (fall > 0) {
        // Falls in from above, entering near the top of the view whatever the
        // zoom, so the streak is on screen for most of the fall
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
        const normal = site.clone().normalize()
        const reach = Math.max(20, camera.position.distanceTo(site))
        const from = site.clone()
          .addScaledVector(normal, reach * 0.3)
          .addScaledVector(up, reach * 0.15)
          .addScaledVector(right, reach * 0.06)
        // A hot head and a tail of earlier positions along the same path,
        // close together and swelling with speed so it reads as one streak
        const TAIL = 20
        for (let i = 0; i < TAIL; i++) {
          const lag = i * 0.008
          glows.add({
            start: now,
            life: fall,
            color: i === 0 ? SODIUM_HOT : SODIUM,
            at: (t, out) => out.copy(from).lerp(site, easeInCubic(Math.max(0, t - lag))),
            size: t => (i === 0 ? 22 : Math.max(5, 15 - i * 0.55)) * (0.85 + 0.45 * t * t),
            alpha: t => (i === 0 ? 1 : 0.7 * (1 - i / TAIL)) * Math.min(1, t * 5),
            hot: () => (i === 0 ? 1 : 0.3),
          })
        }
      }
      // Impact
      glows.add({
        start: impact,
        life: 420,
        color: SODIUM_HOT,
        at: (t, out) => out.copy(site),
        size: t => 26 + 110 * easeOutCubic(t),
        alpha: t => (1 - t) ** 1.6,
        hot: t => 1 - t,
      })
      rings.spawn(now, { lat, lng, color: SODIUM, from: 6, to: 96, width: 3.4, life: 1400, alpha: 1, delay: fall })
      rings.spawn(now, { lat, lng, color: PHOSPHOR, from: 4, to: 54, width: 2, life: 1150, alpha: 0.75, delay: fall + 170 })
      puffs(lat, lng, SODIUM, 5, impact)
      return new Promise(resolve => {
        timers.land = setTimeout(resolve, fall)
      })
    }

    // A one-off dotted course plotted along the great circle from the last
    // place to the new one (drawn out in ~0.4 s, held while the camera flies
    // it, then faded). Transient on purpose: a standing trail between one
    // person's posts would map their travels.
    function trace(from, to, now) {
      const a = from.pos.clone().normalize()
      const b = to.pos.clone().normalize()
      const omega = Math.acos(clamp(a.dot(b), -1, 1))
      const deg = (omega * 180) / Math.PI
      if (deg < 2.5 || reduced) return
      const hold = Math.max(1200, rig.tween ? rig.tween.duration : 1200)
      const count = Math.round(clamp(deg / 1.2, 12, 48))
      const lift = Math.min(0.3, deg / 170)
      const s = Math.sin(omega)
      for (let i = 1; i < count; i++) {
        const f = i / count
        const pos = a.clone().multiplyScalar(Math.sin((1 - f) * omega) / s)
          .addScaledVector(b, Math.sin(f * omega) / s)
          .normalize()
          .multiplyScalar(GLOBE_RADIUS * (1.006 + lift * Math.sin(Math.PI * f)))
        const appear = f * 400
        glows.add({
          start: now + appear,
          life: hold + 500 - appear,
          color: PHOSPHOR,
          at: (t, out) => out.copy(pos),
          size: () => (propsRef.current.compact ? 15 : 13),
          alpha: t => (t < 0.03 ? 1 : 0.75 * (1 - smoothstep(0.6, 1, t))),
          hot: () => 0.9,
        })
      }
    }

    function highlight(key) {
      if (state.highlightKey === key) return
      state.highlightKey = key || null
      state.nextHighlightRing = 0
    }

    function screenPoint(lat, lng) {
      const pos = toVector(lat, lng, 0.006)
      camera.updateMatrixWorld()
      const facing = MarkerLayer.facing(pos, camera)
      pos.project(camera)
      const x = ((pos.x + 1) / 2) * size.w
      const y = ((1 - pos.y) / 2) * size.h
      const rect = mount.getBoundingClientRect()
      return { x: rect.left + x, y: rect.top + y, visible: facing > 0.25 && x >= 0 && x <= size.w && y >= 0 && y <= size.h }
    }

    // ── Pointer: taps pick the nearest dot on screen ───────────────────────
    const pointer = { downs: new Map(), multi: false, hover: null }
    const onPointerDown = event => {
      pointer.downs.set(event.pointerId, { x: event.clientX, y: event.clientY, t: performance.now(), type: event.pointerType, dragged: false })
      if (pointer.downs.size > 1) {
        pointer.multi = true
        rig.cancel()
      }
    }
    const onPointerMove = event => {
      const down = pointer.downs.get(event.pointerId)
      if (down) {
        const limit = down.type === 'mouse' ? 5 : 10
        if (!down.dragged && Math.hypot(event.clientX - down.x, event.clientY - down.y) > limit) {
          down.dragged = true
          rig.cancel() // the user takes the camera
          stopAutoRotate()
        }
        return
      }
      if (canHover && event.pointerType === 'mouse') pointer.hover = { x: event.clientX, y: event.clientY }
    }
    const onPointerUp = event => {
      const down = pointer.downs.get(event.pointerId)
      pointer.downs.delete(event.pointerId)
      const wasMulti = pointer.multi
      if (!pointer.downs.size) pointer.multi = false
      if (!down || down.dragged || wasMulti) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (performance.now() - down.t > (down.type === 'mouse' ? 900 : 650)) return
      // A double tap is one tap: the camera has already started moving, so the
      // second one would land on empty globe and close what the first opened
      if (state.tap && performance.now() - state.tap.at < 450) return
      const rect = mount.getBoundingClientRect()
      const selected = propsRef.current.selectedKey
      const hit = markers.pick(event.clientX - rect.left, event.clientY - rect.top, down.type === 'mouse' ? 18 : 34, camera, size.w, size.h, selected)
      if (hit) {
        if (down.type !== 'mouse') navigator.vibrate?.(6)
        let key = hit.key
        let again = key === selected
        if (again) {
          // Places drawn on top of each other: tapping again steps to the
          // next one there instead of the next fart at the same place
          const group = markers.overlapping(hit, 8, camera, size.w, size.h)
          if (group.length > 1) {
            key = group[(group.indexOf(hit) + 1) % group.length].key
            again = false
          }
        }
        state.tap = { key, at: performance.now() }
        // Inside the gesture, so App can start the audio on iOS
        propsRef.current.onSiteSelect?.(key, { again })
      } else {
        propsRef.current.onBackgroundClick?.()
      }
    }
    const onPointerCancel = event => {
      pointer.downs.delete(event.pointerId)
      if (!pointer.downs.size) pointer.multi = false
    }
    const onPointerLeave = () => { pointer.hover = null }
    const onWheel = () => {
      rig.cancel()
      stopAutoRotate()
      if (!propsRef.current.selectedKey) scheduleAutoRotate()
    }
    const listen = { capture: true, passive: true }
    mount.addEventListener('pointerdown', onPointerDown, listen)
    mount.addEventListener('pointermove', onPointerMove, listen)
    mount.addEventListener('pointerup', onPointerUp, listen)
    mount.addEventListener('pointercancel', onPointerCancel, listen)
    mount.addEventListener('pointerleave', onPointerLeave, listen)
    mount.addEventListener('wheel', onWheel, listen)

    // ── Frame ──────────────────────────────────────────────────────────────
    let frame = 0
    let last = performance.now()
    const tipPos = { x: -1, y: -1 }

    const tick = now => {
      if (disposed) return
      frame = requestAnimationFrame(tick)
      const dt = clamp(now - last, 0, 50)
      last = now
      const p = propsRef.current

      const flying = rig.update(now, controls)
      if (state.pendingMap && !flying && !interacting && !pointer.downs.size) swapTexture()
      controls.dampingFactor = 1 - (1 - DAMPING) ** (dt / 16.667)
      if (p.dimmed !== state.dimmed) {
        state.dimmed = p.dimmed
        controls.autoRotateSpeed = p.dimmed ? 0.12 : 0.35
      }

      // Glide the globe out from under panels and sheets
      const off = state.offset
      if (off.x !== off.tx || off.y !== off.ty) {
        off.x = damp(off.x, off.tx, dt, 110)
        off.y = damp(off.y, off.ty, dt, 110)
        if (reduced || (Math.abs(off.tx - off.x) < 0.4 && Math.abs(off.ty - off.y) < 0.4)) {
          off.x = off.tx
          off.y = off.ty
        }
        g.globeOffset([off.x, off.y])
      }
      camera.updateMatrixWorld()

      tickWarm(now)

      // What's selected: App's answer, or the dot just tapped while App catches up
      const tapped = state.tap && now - state.tap.at < 300 ? state.tap.key : null
      const selected = tapped || p.selectedKey || null
      const selectedEntry = markers.get(selected)

      // Audio: the playing place follows the sound
      const audio = state.audio
      const pid = playingId()
      if (pid !== audio.id) {
        audio.id = pid
        audio.schedule = null
        audio.lastT = -1
        audio.event = pid ? state.eventsById.get(pid) || null : null
        audio.startedAt = now
      }
      const playingEntry = pid ? markers.get(p.playingKey) : null
      let raw = 0
      if (playingEntry) {
        raw = currentLevel()
        if (!audio.schedule) {
          const envelope = playbackEnvelope(pid)
          if (envelope && envelope.end != null) audio.schedule = peakSchedule(envelope)
        }
        if (!audio.schedule) {
          // Waveform not measured yet: a gentle stand-in so the dot isn't dead
          if (raw === 0) raw = 0.2 + 0.12 * Math.sin((now - audio.startedAt) / 75)
        } else {
          const t = currentTime()
          if (t < audio.lastT - 0.05) audio.schedule.forEach(peak => { peak.fired = false })
          const db = volumeToDb(audio.event?.peakVolume)
          const loud = db == null ? 0.7 : clamp((db + 42) / 36, 0.35, 1.15)
          const coreR = (coreSize(playingEntry.count) * scale()) / 2
          for (const peak of audio.schedule) {
            if (peak.fired || t < peak.time || t - peak.time > 0.3) continue
            peak.fired = true
            const { lat, lng } = playingEntry.site
            rings.spawn(now, {
              lat,
              lng,
              color: PHOSPHOR,
              from: coreR + 2,
              to: (18 + 36 * peak.value) * (0.55 + 0.45 * loud),
              width: ringWidth(),
              life: 950,
              alpha: 0.9,
            })
            if (peak.loudest) puffs(lat, lng, PHOSPHOR, 1, now)
          }
          audio.lastT = t
        }
      }
      audio.level = damp(audio.level, raw, dt, raw > audio.level ? 28 : 140)
      const level = playingEntry ? audio.level : 0

      // Markers
      const ignited = markers.update(now, dt, {
        selectedKey: selected,
        highlightKey: state.highlightKey,
        playingKey: playingEntry ? p.playingKey : null,
        level,
        dimmed: p.dimmed,
        scale: scale(),
      })
      for (const entry of ignited) {
        if (entry.quiet) continue
        const coreR = (coreSize(entry.count) * scale()) / 2
        rings.spawn(now, { lat: entry.site.lat, lng: entry.site.lng, color: PHOSPHOR, from: coreR, to: coreR + 12, width: 1.5, life: 560, alpha: 0.55 })
      }

      // Reticle: lock on (with a ping), follow the sound, release
      // (locks once the dot is on, so it never frames an empty spot)
      if (selected !== state.lockedKey && (!selected || (selectedEntry && (selectedEntry.lit || selectedEntry.bornAt == null)))) {
        // The course is plotted only when the camera actually flies it (not,
        // say, when a post lands and the card opens where we already are)
        const previous = markers.get(state.lockedKey)
        if (previous && selectedEntry && rig.tween) trace(previous, selectedEntry, now)
        state.lockedKey = selected
        reticle.lock(selected, selectedEntry?.pos, now, reduced)
        if (selectedEntry) {
          const coreR = (coreSize(selectedEntry.count) * scale()) / 2
          rings.spawn(now, { lat: selectedEntry.site.lat, lng: selectedEntry.site.lng, color: PHOSPHOR, from: coreR + 2, to: 42, width: ringWidth(), life: 760, alpha: 0.85 })
        }
      }
      const reticleHalf = selectedEntry ? Math.max(15, (coreSize(selectedEntry.count) * scale() * 1.22) / 2 + 11) : 16
      reticle.update(now, dt, camera, reticleHalf, selected && selected === p.playingKey ? level : 0)

      // Standing pulses: "still warm" (< 1 h) in sodium, list hover in phosphor
      for (const entry of markers.entries) {
        if (!entry.lit || !entry.fresh) continue
        if (!entry.nextWarmRing) entry.nextWarmRing = now + Math.random() * 1200
        if (now < entry.nextWarmRing) continue
        entry.nextWarmRing = now + 2800
        if (MarkerLayer.facing(entry.pos, camera) <= 0) continue
        const coreR = (coreSize(entry.count) * scale()) / 2
        rings.spawn(now, { lat: entry.site.lat, lng: entry.site.lng, color: SODIUM, from: coreR + 1, to: coreR + 20, width: 1.8, life: 2400, alpha: 0.8 })
      }
      const hl = markers.get(state.highlightKey)
      if (hl?.lit && now >= state.nextHighlightRing) {
        state.nextHighlightRing = now + 1000
        const coreR = (coreSize(hl.count) * scale()) / 2
        rings.spawn(now, { lat: hl.site.lat, lng: hl.site.lng, color: PHOSPHOR, from: coreR + 1, to: coreR + 26, width: ringWidth(), life: 900, alpha: 0.8 })
      }

      rings.update(now, camera, size.h)
      glows.update(now, camera, size.h)

      // Desktop hover label
      if (canHover) {
        let hoverEntry = null
        if (pointer.hover && !pointer.downs.size) {
          hoverEntry = markers.pick(pointer.hover.x - size.left, pointer.hover.y - size.top, 18, camera, size.w, size.h, selected)
        }
        const hoverKey = hoverEntry?.key || null
        if (hoverKey !== state.hoverKey) {
          state.hoverKey = hoverKey
          mount.classList.toggle('is-pointing', Boolean(hoverKey))
          if (tip) {
            if (hoverKey) tip.firstChild.textContent = tipText(hoverEntry.site)
            tip.classList.toggle('is-on', Boolean(hoverKey))
          }
          if (hoverKey) stopAutoRotate()
          else if (!p.selectedKey) scheduleAutoRotate(5000)
        }
        if (hoverEntry && tip) {
          const at = MarkerLayer.project(hoverEntry.pos, camera, size.w, size.h)
          if (at && (Math.abs(at.x - tipPos.x) > 0.3 || Math.abs(at.y - tipPos.y) > 0.3)) {
            tipPos.x = at.x
            tipPos.y = at.y
            const lift = (coreSize(hoverEntry.count) * scale()) / 2 + 14
            tip.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y - lift)}px, 0) translate(-50%, -100%)`
          }
        }
      }
    }

    function setRunning(run) {
      if (run === state.running || disposed) return
      state.running = run
      const now = performance.now()
      if (run) {
        // Time spent paused doesn't count: moves, the warm-up and the
        // switch-ons carry on from where they were
        if (state.pausedAt != null) shiftClock(now - state.pausedAt, state.pausedAt)
        state.pausedAt = null
        rig.resume(now)
        last = now
        frame = requestAnimationFrame(tick)
        g.resumeAnimation()
      } else {
        state.pausedAt = now
        rig.pause(now)
        cancelAnimationFrame(frame)
        frame = 0
        g.pauseAnimation()
      }
    }
    function shiftClock(gap, since) {
      if (!(gap > 0)) return
      const warm = state.warm
      if (warm.started && !warm.done) {
        warm.t0 += gap
        warm.end += gap
      }
      for (const entry of markers.entries) {
        if (entry.lit || entry.bornAt == null || entry.bornAt < since) continue
        entry.bornAt += gap
        if (entry.flashAt != null && entry.flashAt >= since) entry.flashAt += gap
      }
    }
    const syncRunning = () => setRunning(!document.hidden && !propsRef.current.paused)
    syncRunning()

    const resize = () => {
      size.w = mount.clientWidth || window.innerWidth
      size.h = mount.clientHeight || window.innerHeight
      const rect = mount.getBoundingClientRect()
      size.left = rect.left
      size.top = rect.top
      g.width(size.w)
      g.height(size.h)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    document.addEventListener('visibilitychange', syncRunning)
    const onReducedChange = () => { reduced = reducedQuery.matches }
    reducedQuery.addEventListener?.('change', onReducedChange)

    const engine = {
      flyTo,
      frameAll,
      burst,
      land,
      highlight,
      warmUp,
      screenPoint,
      stopAutoRotate,
      scheduleAutoRotate,
      setSites,
      syncRunning,
      setOffset(x, y) {
        state.offset.tx = x
        state.offset.ty = y
      },
      onSelection(key) {
        state.tap = null
        if (key) stopAutoRotate()
        else if (state.hadSelection) scheduleAutoRotate(6000)
        state.hadSelection = Boolean(key)
      },
    }
    engineRef.current = engine
    setSites(propsRef.current.sites.concat(extraSitesRef.current))

    if (import.meta.env.DEV) {
      // Handy in the console and the screenshot harness while developing
      window.__fatwGlobe = g
      window.__fatwGlobeApi = apiRef.current
      window.__fatwGlobeDebug = {
        setExtraSites(list) {
          extraSitesRef.current = list
          engine.setSites(propsRef.current.sites.concat(list))
        },
        pick(x, y, radius = 34) {
          const hit = markers.pick(x - size.left, y - size.top, radius, camera, size.w, size.h, propsRef.current.selectedKey)
          return hit?.key || null
        },
        screen(key) {
          const entry = markers.get(key)
          if (!entry) return null
          camera.updateMatrixWorld()
          const at = MarkerLayer.project(entry.pos, camera, size.w, size.h)
          return at ? { x: at.x + size.left, y: at.y + size.top } : null
        },
        keys: () => markers.entries.filter(entry => entry.lit).map(entry => entry.key),
      }
    }

    return () => {
      setRunning(false) // before `disposed`, which makes setRunning a no-op
      cancelAnimationFrame(frame)
      disposed = true
      rig.cancel()
      Object.values(timers).forEach(clearTimeout)
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncRunning)
      reducedQuery.removeEventListener?.('change', onReducedChange)
      controls.removeEventListener('start', onControlsStart)
      controls.removeEventListener('end', onControlsEnd)
      mount.removeEventListener('pointerdown', onPointerDown, listen)
      mount.removeEventListener('pointermove', onPointerMove, listen)
      mount.removeEventListener('pointerup', onPointerUp, listen)
      mount.removeEventListener('pointercancel', onPointerCancel, listen)
      mount.removeEventListener('pointerleave', onPointerLeave, listen)
      mount.removeEventListener('wheel', onWheel, listen)
      if (engineRef.current === engine) engineRef.current = null
      scene.remove(stars, graticule, markers.points, rings.group, glows.points, reticle.points)
      markers.dispose()
      rings.dispose()
      glows.dispose()
      reticle.dispose()
      stars.geometry.dispose()
      stars.material.dispose()
      graticule.geometry.dispose()
      graticule.material.dispose()
      g._destructor?.()
      // Free the GPU context and the controls' window listeners so a remount
      // (e.g. coming back from a side page) doesn't leak a WebGL context.
      try { controls.dispose() } catch { /* already disposed */ }
      try {
        renderer.dispose()
        renderer.forceContextLoss()
      } catch {
        // already torn down
      }
      mount.innerHTML = ''
      mount.classList.remove('is-pointing')
    }
  }, [])

  // ── Props → engine ────────────────────────────────────────────────────────
  useEffect(() => {
    engineRef.current?.setSites(sites.concat(extraSitesRef.current))
  }, [sites])

  useEffect(() => {
    engineRef.current?.onSelection(selectedKey)
  }, [selectedKey])

  useEffect(() => {
    engineRef.current?.setOffset(offsetX, offsetY)
  }, [offsetX, offsetY])

  useEffect(() => {
    engineRef.current?.syncRunning()
  }, [paused])

  return (
    <>
      <div ref={mountRef} className="globe-mount" role="img" aria-label="Globe with a glowing dot for every place a fart was recorded" />
      <div ref={tipRef} className="globe-tip well well--sm" aria-hidden="true">
        <span className="vfd globe-tip__text" />
      </div>
    </>
  )
})

export default GlobeCanvas
