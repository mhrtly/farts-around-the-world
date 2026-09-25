import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import Globe from 'globe.gl'
import * as THREE from 'three'
import { currentLevel, currentTime, playbackEnvelope, playingId } from '../../utils/player.js'
import { formatCoords, formatLength, siteKey, volumeToDb } from '../../utils/recordings.js'
import {
  GLOBE_RADIUS,
  MAX_ALTITUDE,
  MIN_ALTITUDE,
  TAN_HALF_FOV,
  altitudeForKmPerPx,
  clamp,
  damp,
  easeInCubic,
  easeOutCubic,
  kmPerPx,
  rgb,
  toLatLng,
  toVector,
} from './geo.js'
import { applyPhosphorLook, loadGlobeTexture, makeGraticule, makeStarfield } from './look.js'
import { MarkerLayer } from './markers.js'
import { footprintCentre, petalLayout } from './clusters.js'
import { RingPool } from './rings.js'
import { GlowPool } from './glows.js'
import { Reticle } from './reticle.js'
import { CameraRig } from './camera.js'
import { ZoomController } from './zoom.js'
import { NightTiles } from './tiles.js'
import { LabelLayer } from './labels.js'

const PHOSPHOR = rgb('#62f6d0')
const SODIUM = rgb('#ffa537')
const SODIUM_HOT = [1, 0.86, 0.62]
const GRATICULE_OPACITY = 0.06
const DAMPING = 0.08 // per 60 Hz frame; scaled by the real frame time
// Names beside the markers once the view is regional (km per CSS px)
const NAME_SCALE = 3.2
// How far out a spot may still open into petals (km per CSS px)
const BLOOM_MAX_SCALE = 2.4

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

const shortPlace = spot => (spot?.place ? spot.place.split(',')[0].trim() : null)

// The desktop hover line for a marker
function tipText(node) {
  const spot = node.spot
  const place = shortPlace(spot) || formatCoords(spot.lat, spot.lng)
  if (node.kind === 'petal') {
    const length = node.lead.event?.duration != null ? ` · ${formatLength(node.lead.event.duration)}` : ''
    return `${place} #${node.number}${length}`.toUpperCase()
  }
  if (node.kind === 'single') {
    const length = node.lead.event?.duration != null ? ` · ${formatLength(node.lead.event.duration)}` : ''
    return `${place}${length}`.toUpperCase()
  }
  const places = node.group.spots.length
  return (places > 1 ? `${node.count} farts · ${places} places` : `${place} · ${node.count}`).toUpperCase()
}

const GlobeCanvas = forwardRef(function GlobeCanvas({
  sites,
  selectedId = null,
  playingId: playingEventId = null,
  compact = false,
  offsetX = 0,
  offsetY = 0,
  paused = false,
  dimmed = false,
  onPick,
  onBackgroundClick,
  onReady,
  onWarmupDone,
}, ref) {
  const mountRef = useRef(null)
  const tipRef = useRef(null)
  const labelsRef = useRef(null)
  const engineRef = useRef(null)
  const extraSitesRef = useRef([]) // development only: stand-in places for density tests
  const propsRef = useRef(null)
  propsRef.current = { sites, selectedId, playingEventId, compact, dimmed, paused, offsetX, offsetY, onPick, onBackgroundClick, onReady, onWarmupDone }

  // A stable handle; each call goes to whichever engine is mounted.
  const apiRef = useRef(null)
  if (!apiRef.current) {
    const engine = () => engineRef.current
    const listeners = new Set()
    apiRef.current = {
      flyTo: (target, options) => engine()?.flyTo(target, options) || Promise.resolve(false),
      frameAll: ms => engine()?.frameAll(ms) || Promise.resolve(false),
      burst: (lat, lng, options) => engine()?.burst(lat, lng, options),
      land: (lat, lng) => engine()?.land(lat, lng) || Promise.resolve(),
      highlight: id => engine()?.highlight(id),
      warmUp: () => engine()?.warmUp(),
      resumeAutoRotate: () => engine()?.scheduleAutoRotate(0),
      stopAutoRotate: () => engine()?.stopAutoRotate(),
      screenPoint: (lat, lng) => engine()?.screenPoint(lat, lng) || { x: window.innerWidth / 2, y: window.innerHeight / 2, visible: false },
      zoomBy: factor => engine()?.zoomBy(factor),
      zoomState: () => engine()?.zoomState() || null,
      // Zoom readouts (the zoom keys, the scale) listen here: called with
      // { altitude, kmPerPx, atMin, atMax } whenever the height changes
      onZoom: listener => {
        listeners.add(listener)
        const now = engine()?.zoomState()
        if (now) listener(now)
        return () => listeners.delete(listener)
      },
      _emitZoom: state => listeners.forEach(listener => listener(state)),
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

    const uniforms = { uWarm: { value: reduced ? 1 : 0 }, uGrid: { value: 0 } }
    applyPhosphorLook(g.globeMaterial(), uniforms)

    const size = { w: mount.clientWidth || window.innerWidth, h: mount.clientHeight || window.innerHeight, left: 0, top: 0 }
    const stars = makeStarfield(phoneAtStart ? 900 : 1600, pixelRatio)
    const graticule = makeGraticule(15)
    const markers = new MarkerLayer(pixelRatio)
    const rings = new RingPool(40)
    const glows = new GlowPool(128, pixelRatio)
    const reticle = new Reticle(pixelRatio)
    const tiles = new NightTiles(renderer, uniforms, { phone: phoneAtStart })
    const labels = new LabelLayer(labelsRef.current)
    const rig = new CameraRig(g)
    rig.pause(performance.now()) // until the first frame renders
    scene.add(stars, tiles.group, graticule, markers.group, rings.group, glows.points, reticle.points)
    if (reduced) graticule.material.opacity = GRATICULE_OPACITY

    const state = {
      running: false,
      hoverKey: null,
      highlightId: null,
      nextHighlightRing: 0,
      tap: null, // { id, at } — shown selected until App confirms
      lockedId: null,
      lockedNode: null,
      offset: { x: propsRef.current.offsetX, y: propsRef.current.offsetY, tx: propsRef.current.offsetX, ty: propsRef.current.offsetY },
      landings: new Map(), // spot key → impact time, for recordings that don't exist yet
      audio: { id: null, schedule: null, lastT: -1, level: 0, event: null, startedAt: 0 },
      warm: { started: false, done: false, t0: 0, ramp: 1600, end: 0, fast: false },
      pausedAt: performance.now(), // not rendering yet
      pendingMap: null, // the sharper texture, waiting for a still moment
      dimmed: false,
      bgTap: null, // the last tap on empty globe, for double-tap zoom
      zoomSent: null,
      labelsKey: '',
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
    // Zooming is ours (zoom.js: toward the cursor, pinch-and-pan); the
    // controls keep the drag. Close enough for town level, far enough for
    // the whole planet.
    controls.enableZoom = false
    controls.minDistance = GLOBE_RADIUS * (1 + MIN_ALTITUDE * 0.98)
    controls.maxDistance = GLOBE_RADIUS * (1 + MAX_ALTITUDE)
    // Drag speed follows the height, so the ground moves with the finger
    // up close (globe.gl sets its own on every change; this runs after it)
    const onControlsChange = () => {
      const h = camera.position.length() / GLOBE_RADIUS - 1
      controls.rotateSpeed = h * (0.16 + 0.14 * smoothstep(0.3, 2, h))
    }
    controls.addEventListener('change', onControlsChange)

    // Parked just off the data until the splash lifts; frameAll() glides in.
    g.pointOfView({ lat: 24, lng: -58, altitude: phoneAtStart ? 3.4 : 3 }, 0)

    // ── Auto-rotate ────────────────────────────────────────────────────────
    let interacting = false
    function stopAutoRotate() {
      clearTimeout(timers.rotate)
      if (controls.autoRotate) {
        controls.autoRotate = false
        // The spin it leaves in the damping would carry the view ~0.5°
        // (tens of km, up close) after it's off
        controls._sphericalDelta?.set(0, 0, 0)
      }
    }
    function scheduleAutoRotate(delay = 12000) {
      clearTimeout(timers.rotate)
      timers.rotate = setTimeout(() => {
        if (disposed || reduced || interacting || propsRef.current.selectedId || state.hoverKey) return
        // Not while zoomed in: the ground would slide out from under you
        if (g.pointOfView().altitude < 0.9) return
        controls.autoRotate = true
      }, delay)
    }
    const onControlsStart = () => {
      interacting = true
      stopAutoRotate()
    }
    const onControlsEnd = () => {
      interacting = false
      if (!propsRef.current.selectedId) scheduleAutoRotate()
    }
    controls.addEventListener('start', onControlsStart)
    controls.addEventListener('end', onControlsEnd)

    // ── Zoom ───────────────────────────────────────────────────────────────
    const zoom = new ZoomController({
      globe: g,
      camera,
      mount,
      size,
      onUserZoom: () => {
        rig.cancel() // the user takes the camera
        stopAutoRotate()
        if (!propsRef.current.selectedId) scheduleAutoRotate()
      },
    })
    zoom.reduced = reduced

    function zoomState() {
      const altitude = g.pointOfView().altitude
      return {
        altitude,
        kmPerPx: kmPerPx(altitude, size.h),
        atMin: altitude <= MIN_ALTITUDE * 1.03,
        atMax: altitude >= MAX_ALTITUDE * 0.97,
      }
    }

    // Zoom keys and the keyboard: around the open fart if it's on screen
    // (so it stays put), else around the middle of the globe
    function zoomBy(factor) {
      rig.cancel()
      stopAutoRotate()
      const node = markers.nodeOf(propsRef.current.selectedId)
      let at = null
      if (node) {
        const p = MarkerLayer.project(node.lead.pos, camera, size.w, size.h)
        if (p && p.x > 0 && p.y > 0 && p.x < size.w && p.y < size.h) at = { x: p.x, y: p.y, point: node.lead.pos.clone().normalize() }
      }
      zoom.zoomTo(zoom.targetAltitude() * factor, at, { tau: 120 })
    }

    // ── Grouping ───────────────────────────────────────────────────────────
    const currentScale = () => kmPerPx(g.pointOfView().altitude, size.h)
    const groupingOptions = () => {
      const phone = propsRef.current.compact
      const petalSpacing = phone ? 34 : 26
      const mergePx = phone ? 30 : 24
      return {
        mergePx,
        petalSpacing,
        petalSize: phone ? 7 : 6.2,
        dotScale: phone ? 1 : 0.92,
        bloomMaxScale: BLOOM_MAX_SCALE,
        // Room for the ring plus a clear gap to the nearest other marker
        bloomNeed: count => petalLayout(count, petalSpacing).radius + mergePx * 0.5 + 26,
      }
    }

    // ── Sites ──────────────────────────────────────────────────────────────
    function setSites(list) {
      const added = markers.setSites(list)
      const now = performance.now()
      for (const item of added) {
        const impact = state.landings.get(item.spot.key)
        if (impact) {
          item.bornAt = impact
          item.flashAt = impact
        } else if (state.warm.done) {
          const spotLit = item.spot.events.some(event => markers.get(event.id)?.lit)
          if (spotLit) {
            // Joins a place that's already lit: on now (it flashes when its
            // arrival is announced)
            item.bornAt = now
            item.quiet = true
          } else {
            // A new place: stays dark for a moment in case its arrival is
            // about to be announced (land() for our own post, burst() for a
            // live one), so the dot switches on with its effect
            item.bornAt = now + 1700
            item.flashAt = item.bornAt
          }
        } else if (state.warm.started) {
          item.bornAt = Math.max(now, state.warm.end)
          item.flashAt = item.bornAt
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
      const order = [...markers.spots].sort((a, b) => a.oldest - b.oldest)
      const begin = warm.t0 + (reduced ? 0 : warm.fast ? 200 : 450)
      const span = warm.fast ? 450 : 1100
      const stagger = reduced || order.length < 2 ? 0 : Math.min(warm.fast ? 30 : 70, span / (order.length - 1))
      order.forEach((spot, i) => {
        for (const event of spot.events) {
          const item = markers.get(event.id)
          if (!item || item.bornAt != null) continue
          item.bornAt = begin + i * stagger
          item.flashAt = item.bornAt
          item.quiet = reduced
        }
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
      state.graticuleWarm = reduced ? 1 : clamp((t - (warm.fast ? 100 : 250)) / (warm.fast ? 400 : 900), 0, 1)
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
    // How low to come for one recording: low enough that it's drawn on its
    // own (split from its neighbours, and opened into petals if it shares
    // its spot), within sensible limits, and never zooming out from where
    // the user already is.
    function focusAltitude(lat, lng) {
      const phone = propsRef.current.compact
      const hi = phone ? 1.75 : 1.35
      const current = g.pointOfView().altitude
      let needed = hi
      const opts = groupingOptions()
      const spot = markers.spot(siteKey(lat, lng))
      let scale = Infinity
      if (spot) scale = markers.grouping.focusScale(spot, opts)
      else {
        // Not on the map yet (a post on its way): far enough in that it'll
        // land apart from its nearest neighbour
        const nearest = markers.grouping.nearestKm(toVector(lat, lng, 0).normalize())
        if (Number.isFinite(nearest)) scale = nearest / (opts.mergePx * 1.3)
      }
      if (Number.isFinite(scale)) needed = altitudeForKmPerPx(scale, size.h)
      return clamp(Math.min(current, hi, needed), MIN_ALTITUDE, hi)
    }

    // Start fetching close-up tiles for where a move will end
    const scratchCamera = camera.clone()
    function prefetchAt(lat, lng, altitude) {
      if (altitude >= 0.55 || !state.warm.done) return
      scratchCamera.copy(camera)
      toVector(lat, lng, altitude, scratchCamera.position)
      scratchCamera.up.set(0, 1, 0)
      scratchCamera.lookAt(0, 0, 0)
      scratchCamera.updateMatrixWorld()
      tiles.prefetch(scratchCamera, size, altitude)
    }

    function flyTo(target, options) {
      const opts = typeof options === 'number' ? { ms: options } : (options || {})
      if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return Promise.resolve(false)
      const altitude = Number.isFinite(target.altitude) ? target.altitude : focusAltitude(target.lat, target.lng)
      stopAutoRotate()
      zoom.stop()
      prefetchAt(target.lat, target.lng, altitude)
      return rig.flyTo({ lat: target.lat, lng: target.lng, altitude }, { ms: opts.ms, style: opts.style || 'push', reduced })
    }

    // A tap on a cluster: come down until it opens up (splits, or blooms
    // into petals), framing all of it in the space a deck leaves free
    function expand(node) {
      const group = node.group
      if (!group) return
      const phone = propsRef.current.compact
      const opts = groupingOptions()
      const open = markers.grouping.openScale(group, opts)
      const centre = footprintCentre(group)
      const extent = markers.grouping.extentKm(group, centre)
      const landscape = phone && size.w > size.h
      const freeW = landscape ? size.w * 0.5 : phone ? size.w - 48 : Math.max(320, size.w - 840)
      const freeH = landscape ? size.h - 120 : phone ? size.h * 0.36 : Math.max(300, size.h - 300)
      let scale
      if (group.spots.length === 1) {
        // One spot: just far enough in for its petals to open, with room
        scale = open * 0.8
      } else {
        // Several: frame them all as large as the free space allows, without
        // diving far past the point where they come apart
        const fit = (2 * extent) / (Math.min(freeW, freeH) * 0.8)
        scale = Math.max(fit, open * 0.12)
      }
      scale = Math.max(scale, kmPerPx(MIN_ALTITUDE, size.h))
      if (scale > open) scale = open * 0.95
      const current = g.pointOfView().altitude
      let altitude = Math.min(current, altitudeForKmPerPx(scale, size.h))
      if (altitude > current * 0.95) altitude = current * 0.5 // always a real step in
      altitude = clamp(altitude, MIN_ALTITUDE, MAX_ALTITUDE)
      const { lat, lng } = toLatLng(centre)
      stopAutoRotate()
      zoom.stop()
      prefetchAt(lat, lng, altitude)
      rig.flyTo({ lat, lng, altitude }, { style: 'push', reduced })
    }

    // Centre on the places' mean direction, high enough that all of them fit
    function frameAll(ms = 2400) {
      const phone = propsRef.current.compact
      const landscape = phone && size.w > size.h
      const spots = markers.spots
      zoom.stop()
      // The establishing glide at reveal waits a beat for the splash to clear
      const intro = state.warm.started && !state.warm.done
      const move = { ms: intro ? Math.max(ms, 2600) : ms, style: 'settle', reduced, delay: intro && !reduced ? 250 : 0 }
      if (!spots.length) {
        return rig.flyTo({ lat: 28, lng: -40, altitude: phone ? 2.6 : 2.3 }, move)
      }
      // Aim at the part of the world with the most places (all of them, when
      // they fit on one side of the planet), not at an average that lands in
      // an empty ocean or on the pole.
      const dirs = spots.map(spot => spot.dir.clone())
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
        spots.forEach((spot, i) => { if (spot.latest > spots[newest].latest) newest = i })
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
    const ringWidth = () => (propsRef.current.compact ? 2.6 : 2.1)
    const drawnRadius = node => (MarkerLayer.drawnSize(node) || 5) / 2
    // Where a recording's marker is right now (follows it as it moves)
    const follow = id => () => markers.nodeOf(id)?.lead.pos || null

    // Puffs drift a few dozen pixels whatever the zoom, so they're sized in
    // degrees from the current scale
    function puffs(lat, lng, color, count, start) {
      const degPerPx = currentScale() / 111.2
      const lift = currentScale() / 6371
      for (let i = 0; i < count; i++) {
        const dLat = (Math.random() - 0.5) * 36 * degPerPx
        const dLng = ((Math.random() - 0.5) * 36 * degPerPx) / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
        const px = 16 + Math.random() * 10
        glows.add({
          start: start + i * 120,
          life: 2200 + Math.random() * 700,
          color,
          at: (t, out) => toVector(lat + dLat * (0.4 + t), lng + dLng * (0.4 + t), lift * (1 + t * 26), out),
          size: t => Math.min(90, px * (0.6 + t * 1.6)),
          alpha: t => Math.sin(Math.min(1, t * 3) * Math.PI / 2) * (1 - t) * 0.5,
        })
      }
    }

    function burst(lat, lng, { color = '#ffa537', big = false } = {}) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const now = performance.now()
      const c = rgb(color)
      const spot = markers.spot(siteKey(lat, lng))
      const newest = spot?.events[0]?.id
      const at = newest ? follow(newest) : null
      rings.spawn(now, { lat, lng, at, color: c, from: 4, to: big ? 72 : 46, width: big ? 3.2 : ringWidth(), life: big ? 1500 : 1150, alpha: 0.95 })
      rings.spawn(now, { lat, lng, at, color: c, from: 3, to: big ? 44 : 28, width: 1.8, life: 1000, alpha: 0.6, delay: 240 })
      puffs(lat, lng, c, big ? 6 : 4, now)
      for (const event of spot?.events || []) {
        const item = markers.get(event.id)
        if (!item) continue
        if (!item.lit && item.bornAt != null) item.bornAt = now
        item.quiet = false
        item.flashAt = now
      }
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
      for (const event of markers.spot(key)?.events || []) {
        const item = markers.get(event.id)
        if (!item) continue
        if (!item.lit || now - item.bornAt < 4000) {
          item.bornAt = impact // new (or only just appeared): dark until the hit
          item.lit = false
        }
        item.quiet = false
        item.flashAt = impact
      }
      const site = toVector(lat, lng, 0.00003)
      if (fall > 0) {
        // Falls in from above, entering near the top of the view whatever the
        // zoom, so the streak is on screen for most of the fall
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
        const normal = site.clone().normalize()
        const reach = Math.max(0.05, camera.position.distanceTo(site))
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
    function trace(fromPos, toPos, now) {
      const a = fromPos.clone().normalize()
      const b = toPos.clone().normalize()
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

    function highlight(id) {
      if (state.highlightId === (id || null)) return
      state.highlightId = id || null
      state.nextHighlightRing = 0
    }

    function screenPoint(lat, lng) {
      const pos = toVector(lat, lng, 0.00003)
      camera.updateMatrixWorld()
      const facing = MarkerLayer.facing(pos, camera)
      pos.project(camera)
      const x = ((pos.x + 1) / 2) * size.w
      const y = ((1 - pos.y) / 2) * size.h
      const rect = mount.getBoundingClientRect()
      return { x: rect.left + x, y: rect.top + y, visible: facing > 0.25 && x >= 0 && x <= size.w && y >= 0 && y <= size.h }
    }

    // ── Pointer: taps pick the nearest marker on screen ────────────────────
    const pointer = { downs: new Map(), multi: false, hover: null }

    function handlePick(node, touch) {
      const now = performance.now()
      const selected = propsRef.current.selectedId
      if (touch) navigator.vibrate?.(6)
      state.lastPickAt = now // kept after App confirms (state.tap is cleared then)
      if (node.kind === 'cluster') {
        // The newest fart there plays (or the next one, when this marker
        // already holds the open fart), and the camera comes down until the
        // cluster opens up
        const at = node.ids.indexOf(selected)
        const id = at >= 0 ? node.ids[(at + 1) % node.ids.length] : node.ids[0]
        state.tap = { id, at: now }
        expand(node)
        // Inside the gesture, so App can start the audio on iOS
        propsRef.current.onPick?.({ id, kind: 'cluster' })
        return
      }
      const id = node.lead.id
      state.tap = { id, at: now }
      propsRef.current.onPick?.({ id, kind: 'recording', again: id === selected })
    }

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
          zoom.stop()
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
      const now = performance.now()
      if (now - down.t > (down.type === 'mouse' ? 900 : 650)) return
      // A double tap on a marker is one tap: the camera has already started
      // moving, so the second one would land on empty globe
      if (now - (state.lastPickAt || 0) < 450) return
      const rect = mount.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const touch = down.type !== 'mouse'
      const phone = propsRef.current.compact
      const radius = touch ? 30 : 16
      const petalRadius = Math.min(radius, (phone ? 34 : 26) * 0.62)
      const node = markers.pick(x, y, radius, camera, size.w, size.h, propsRef.current.selectedId, petalRadius)
      if (node) {
        clearTimeout(timers.bgTap)
        state.bgTap = null
        handlePick(node, touch)
        return
      }
      // Empty globe. A second tap close by, soon after, zooms in there (a
      // double tap / double click); a lone tap closes what's open.
      const last = state.bgTap
      if (last && now - last.at < 340 && Math.hypot(x - last.x, y - last.y) < 40) {
        clearTimeout(timers.bgTap)
        state.bgTap = null
        zoom.zoomAt(x, y, 1 / 2.6)
        return
      }
      state.bgTap = { at: now, x, y }
      clearTimeout(timers.bgTap)
      timers.bgTap = setTimeout(() => {
        state.bgTap = null
        propsRef.current.onBackgroundClick?.()
      }, 300)
    }
    const onPointerCancel = event => {
      pointer.downs.delete(event.pointerId)
      if (!pointer.downs.size) pointer.multi = false
    }
    const onPointerLeave = () => { pointer.hover = null }
    const listen = { capture: true, passive: true }
    mount.addEventListener('pointerdown', onPointerDown, listen)
    mount.addEventListener('pointermove', onPointerMove, listen)
    mount.addEventListener('pointerup', onPointerUp, listen)
    mount.addEventListener('pointercancel', onPointerCancel, listen)
    mount.addEventListener('pointerleave', onPointerLeave, listen)

    // ── Frame ──────────────────────────────────────────────────────────────
    let frame = 0
    let last = performance.now()
    const tipPos = { x: -1, y: -1 }
    const lastCam = new THREE.Vector3()

    const tick = now => {
      if (disposed) return
      frame = requestAnimationFrame(tick)
      const dt = clamp(now - last, 0, 50)
      last = now
      const p = propsRef.current

      const flying = rig.update(now, controls)
      const zooming = zoom.update(dt)
      if (state.pendingMap && !flying && !zooming && !interacting && !pointer.downs.size) swapTexture()
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
      const altitude = camera.position.length() / GLOBE_RADIUS - 1
      const scale = kmPerPx(altitude, size.h)
      // Never spin the planet under someone who's down close
      if (controls.autoRotate && altitude < 0.85) controls.autoRotate = false

      tickWarm(now)
      // Up close the graticule (floating a few km up) would swim over the
      // ground, and the NASA tiles take over from the soft base texture
      graticule.material.opacity = GRATICULE_OPACITY * (state.graticuleWarm ?? (reduced ? 1 : 0)) * smoothstep(0.035, 0.1, altitude)
      graticule.visible = graticule.material.opacity > 0.001
      uniforms.uGrid.value = (state.graticuleWarm ?? (reduced ? 1 : 0)) * smoothstep(0.5, 0.28, altitude)
      tiles.update(now, dt, camera, size, altitude, state.warm.done, Boolean(rig.tween) && now < rig.tween.start + rig.tween.duration * 0.8)

      // Zoom readouts
      const sent = state.zoomSent
      if (!sent || Math.abs(Math.log(altitude / sent.altitude)) > 0.004 || size.h !== sent.h) {
        const zs = zoomState()
        state.zoomSent = { altitude, h: size.h }
        apiRef.current._emitZoom(zs)
      }

      // Grouping for this zoom (only changes when a threshold is crossed)
      const opts = groupingOptions()
      markers.layout(now, { ...opts, scale, reduced })

      // What's selected: App's answer, or the marker just tapped while App catches up
      const tapped = state.tap && now - state.tap.at < 300 ? state.tap.id : null
      const selected = tapped || p.selectedId || null
      const selectedNode = markers.nodeOf(selected)

      // Audio: the playing fart's marker follows the sound
      const audio = state.audio
      const pid = playingId()
      if (pid !== audio.id) {
        audio.id = pid
        audio.schedule = null
        audio.lastT = -1
        audio.event = pid ? markers.get(pid)?.event || null : null
        audio.startedAt = now
      }
      const playingNode = pid && pid === p.playingEventId ? markers.nodeOf(pid) : null
      let raw = 0
      if (playingNode) {
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
          const coreR = drawnRadius(playingNode)
          for (const peak of audio.schedule) {
            if (peak.fired || t < peak.time || t - peak.time > 0.3) continue
            peak.fired = true
            const { lat, lng } = playingNode.spot
            rings.spawn(now, {
              lat,
              lng,
              at: follow(pid),
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
      const level = playingNode ? audio.level : 0

      // Markers
      const ignited = markers.update(now, dt, camera, {
        selectedId: selected,
        highlightId: state.highlightId,
        playingId: playingNode ? pid : null,
        level,
        dimmed: p.dimmed,
        viewportHeight: size.h,
      })
      for (const node of ignited) {
        const r = drawnRadius(node)
        rings.spawn(now, { lat: node.spot.lat, lng: node.spot.lng, at: follow(node.lead.id), color: PHOSPHOR, from: r, to: r + 12, width: 1.5, life: 560, alpha: 0.55 })
      }

      // Reticle: lock on (with a ping), follow the marker and the sound,
      // release. Locks once the marker is on, so it never frames an empty spot.
      if (selected !== state.lockedId && (!selected || selectedNode?.lit)) {
        // The course is plotted only when the camera actually flies it (not,
        // say, when a post lands and the card opens where we already are)
        if (state.lockedNode && selectedNode && rig.tween) trace(state.lockedNode.lead.pos, selectedNode.lead.pos, now)
        state.lockedId = selected
        state.lockedNode = selectedNode
        reticle.lock(selected, selectedNode?.lead.pos, now, reduced)
        if (selectedNode) {
          const r = drawnRadius(selectedNode)
          rings.spawn(now, { lat: selectedNode.spot.lat, lng: selectedNode.spot.lng, at: follow(selected), color: PHOSPHOR, from: r + 2, to: 42, width: ringWidth(), life: 760, alpha: 0.85 })
        }
      }
      if (selectedNode) state.lockedNode = selectedNode
      const reticleHalf = selectedNode ? Math.max(15, drawnRadius(selectedNode) * 1.22 + 11) : 16
      reticle.update(now, dt, camera, reticleHalf, selectedNode && selectedNode === playingNode ? level : 0, selectedNode?.lead.pos)

      // Standing pulses: "still warm" (< 1 h) in sodium, list hover in phosphor
      for (const node of markers.nodes) {
        if (!node.fresh || node.lead.alpha < 0.5) continue
        if (!node.nextWarmRing) node.nextWarmRing = now + Math.random() * 1200
        if (now < node.nextWarmRing) continue
        node.nextWarmRing = now + 2800
        if (MarkerLayer.facing(node.lead.pos, camera) <= 0) continue
        const r = drawnRadius(node)
        rings.spawn(now, { lat: node.spot.lat, lng: node.spot.lng, at: follow(node.lead.id), color: SODIUM, from: r + 1, to: r + 20, width: 1.8, life: 2400, alpha: 0.8 })
      }
      const hl = markers.nodeOf(state.highlightId)
      if (hl?.lit && now >= state.nextHighlightRing) {
        state.nextHighlightRing = now + 1000
        const r = drawnRadius(hl)
        rings.spawn(now, { lat: hl.spot.lat, lng: hl.spot.lng, at: follow(state.highlightId), color: PHOSPHOR, from: r + 1, to: r + 26, width: ringWidth(), life: 900, alpha: 0.8 })
      }

      rings.update(now, camera, size.h, altitude)
      glows.update(now, camera, size.h)

      // Names and counts beside the markers (only when something moved)
      const camMoved = lastCam.distanceToSquared(camera.position) > 1e-12
      lastCam.copy(camera.position)
      const labelsKey = `${markers.layoutVersion}|${selected}|${state.warm.done}|${p.dimmed}|${size.w}x${size.h}|${off.x},${off.y}`
      if (camMoved || markers.moving(now) || labelsKey !== state.labelsKey || now - (state.labelsAt || 0) > 300) {
        state.labelsAt = now
        state.labelsKey = labelsKey
        if (!state.warm.done || p.dimmed) labels.update([], [], size.w, size.h)
        else placeLabels(scale, selectedNode)
      }

      // Desktop hover label
      if (canHover) {
        let hoverNode = null
        if (pointer.hover && !pointer.downs.size) {
          hoverNode = markers.pick(pointer.hover.x - size.left, pointer.hover.y - size.top, 16, camera, size.w, size.h, selected, Math.min(16, 26 * 0.62))
        }
        // (a cluster keeps its key as it splits: its size is part of what's shown)
        const hoverKey = hoverNode ? `${hoverNode.key}|${hoverNode.kind}|${hoverNode.count}` : null
        if (hoverKey !== state.hoverKey) {
          state.hoverKey = hoverKey
          mount.classList.toggle('is-pointing', Boolean(hoverKey))
          if (tip) {
            if (hoverKey) tip.firstChild.textContent = tipText(hoverNode)
            tip.classList.toggle('is-on', Boolean(hoverKey))
          }
          if (hoverKey) stopAutoRotate()
          else if (!p.selectedId) scheduleAutoRotate(5000)
        }
        if (hoverNode && tip) {
          const at = MarkerLayer.project(hoverNode.lead.pos, camera, size.w, size.h)
          if (at && (Math.abs(at.x - tipPos.x) > 0.3 || Math.abs(at.y - tipPos.y) > 0.3)) {
            tipPos.x = at.x
            tipPos.y = at.y
            const lift = drawnRadius(hoverNode) + 14
            tip.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y - lift)}px, 0) translate(-50%, -100%)`
          }
        }
      }
    }

    // Panels that sit over the globe: labels never go under them. Measured
    // at most four times a second (they move rarely; sheets slide).
    const COVERS = '.side-panel, .sheet-layer.is-open .sheet, .front-panel.is-powered:not(.is-hidden), .zoom:not(.is-hidden) .zoom__stack, .zoom__scale.is-on, .topbar__id, .menu-key, .hint-slot, .toasts > *'
    function coverRects(now) {
      if (state.covers && now - state.coversAt < 250) return state.covers
      const origin = mount.getBoundingClientRect()
      state.covers = [...document.querySelectorAll(COVERS)]
        .map(el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0)
        .map(r => ({ x0: r.left - origin.left - 4, y0: r.top - origin.top - 4, x1: r.right - origin.left + 4, y1: r.bottom - origin.top + 4 }))
      state.coversAt = now
      return state.covers
    }

    // Labels: a count beside every cluster; names once the view is regional;
    // a bloom's name and count over its ring of petals
    function placeLabels(scale, selectedNode) {
      const specs = []
      const dots = []
      const opts = groupingOptions()
      const named = scale <= NAME_SCALE
      for (const node of markers.nodes) {
        if (!node.lit || node.lead.alpha < 0.5) continue
        const at = MarkerLayer.project(node.lead.pos, camera, size.w, size.h)
        if (!at) continue
        // The open fart's marker wears the reticle: keep labels outside it
        const r = selectedNode === node ? Math.max(15, drawnRadius(node) * 1.22 + 11) + 1 : drawnRadius(node)
        dots.push({ key: node.key, x: at.x, y: at.y, r: r + 2 })
        if (node.kind === 'petal') continue
        const onePlace = node.kind !== 'cluster' || node.group.spots.every(spot => shortPlace(spot) === shortPlace(node.spot))
        const name = named && onePlace ? shortPlace(node.spot) : null
        const count = node.kind === 'cluster' ? node.count : null
        if (!name && !count) continue
        const mine = selectedNode === node
        specs.push({ key: node.key, x: at.x, y: at.y, r, name, count, priority: (mine ? 1e6 : 0) + node.count * 10 + (name ? 1 : 0), tone: mine ? 'sel' : '' })
      }
      for (const key of markers.grouping.bloomed) {
        const spot = markers.spot(key)
        if (!spot) continue
        const pin = MarkerLayer.project(spot.dir.clone().multiplyScalar(GLOBE_RADIUS), camera, size.w, size.h)
        if (!pin) continue
        const radius = petalLayout(spot.count, opts.petalSpacing).radius
        const mine = selectedNode?.spot === spot
        dots.push({ key: `pin:${key}`, x: pin.x, y: pin.y, r: 5 })
        specs.push({
          key: `bloom:${key}`,
          x: pin.x,
          y: pin.y,
          r: radius + 6,
          above: true,
          name: shortPlace(spot),
          count: spot.count,
          priority: (mine ? 1e6 : 0) + spot.count * 10 + 5,
          tone: mine ? 'sel' : '',
        })
      }
      labels.update(specs, dots, size.w, size.h, coverRects(performance.now()))
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
        zoom.stop()
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
      for (const item of markers.items) {
        if (item.lit || item.bornAt == null || item.bornAt < since) continue
        item.bornAt += gap
        if (item.flashAt != null && item.flashAt >= since) item.flashAt += gap
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
    const onReducedChange = () => {
      reduced = reducedQuery.matches
      zoom.reduced = reduced
    }
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
      zoomBy,
      zoomState,
      setOffset(x, y) {
        state.offset.tx = x
        state.offset.ty = y
      },
      onSelection(id) {
        state.tap = null
        if (id) stopAutoRotate()
        else if (state.hadSelection) scheduleAutoRotate(6000)
        state.hadSelection = Boolean(id)
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
        pick(x, y, radius = 30) {
          const node = markers.pick(x - size.left, y - size.top, radius, camera, size.w, size.h, propsRef.current.selectedId, Math.min(radius, 21))
          return node ? { key: node.key, kind: node.kind, ids: node.ids } : null
        },
        // Screen position of the marker holding a recording (or a spot key)
        screen(idOrKey) {
          const node = markers.nodeOf(idOrKey) || markers.nodes.find(n => n.key === idOrKey || n.spot?.key === idOrKey)
          if (!node) return null
          camera.updateMatrixWorld()
          const at = MarkerLayer.project(node.lead.pos, camera, size.w, size.h)
          return at ? { x: at.x + size.left, y: at.y + size.top } : null
        },
        nodes() {
          camera.updateMatrixWorld()
          return markers.nodes.filter(node => node.lit).map(node => {
            const at = MarkerLayer.project(node.lead.pos, camera, size.w, size.h)
            return { key: node.key, kind: node.kind, count: node.count, ids: node.ids, x: at ? Math.round(at.x + size.left) : null, y: at ? Math.round(at.y + size.top) : null, alpha: +node.lead.alpha.toFixed(2) }
          })
        },
        pov: () => g.pointOfView(),
        scale: () => currentScale(),
        zoomTo: (altitude, x, y) => zoom.zoomTo(altitude, x != null ? { x, y } : null),
        tiles: () => ({ level: tiles.level, keys: [...tiles.shown].map(entry => entry.key), shown: tiles.shown.size, cached: tiles.cache.size, loaded: tiles.loaded, failures: tiles.failures, disabled: tiles.disabled, alpha: +tiles.alpha.toFixed(2) }),
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
      controls.removeEventListener('change', onControlsChange)
      mount.removeEventListener('pointerdown', onPointerDown, listen)
      mount.removeEventListener('pointermove', onPointerMove, listen)
      mount.removeEventListener('pointerup', onPointerUp, listen)
      mount.removeEventListener('pointercancel', onPointerCancel, listen)
      mount.removeEventListener('pointerleave', onPointerLeave, listen)
      zoom.dispose()
      if (engineRef.current === engine) engineRef.current = null
      scene.remove(stars, tiles.group, graticule, markers.group, rings.group, glows.points, reticle.points)
      markers.dispose()
      rings.dispose()
      glows.dispose()
      reticle.dispose()
      tiles.dispose()
      labels.dispose()
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
    engineRef.current?.onSelection(selectedId)
  }, [selectedId])

  useEffect(() => {
    engineRef.current?.setOffset(offsetX, offsetY)
  }, [offsetX, offsetY])

  useEffect(() => {
    engineRef.current?.syncRunning()
  }, [paused])

  return (
    <>
      <div ref={mountRef} className="globe-mount" role="img" aria-label="Globe with a glowing dot for every place a fart was recorded" />
      <div ref={labelsRef} className="globe-labels" aria-hidden="true" />
      <div ref={tipRef} className="globe-tip well well--sm" aria-hidden="true">
        <span className="vfd globe-tip__text" />
      </div>
    </>
  )
})

export default GlobeCanvas
