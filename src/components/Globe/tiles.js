// Sharper night lights up close: NASA's Black Marble (VIIRS, 2016) as 256 px
// Web Mercator tiles from NASA GIBS, laid over the globe once the camera is
// low enough that the base texture goes soft. They get the same phosphor
// treatment as the globe (dark teal land, sodium city light), so the switch
// reads as the picture coming into focus rather than a new map.
//
// Only what's on screen is fetched, at the level that matches the screen's
// pixels (level 8, ~500 m a pixel, is the finest). Tiles fade in as they
// arrive; until then a loaded parent (or its four loaded children) stands
// in. A small LRU keeps recent ones. If GIBS can't be reached the layer
// quietly gives up and the base globe carries on.

import * as THREE from 'three'
import { EARTH_KM, clamp, surfacePoint, toLatLng, toVector } from './geo.js'
import { applyNightTileLook } from './look.js'

const tileUrl = (z, x, y) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`

const MIN_LEVEL = 2
const MAX_LEVEL = 8
export const TILES_FROM_ALTITUDE = 0.55 // start fading in below this height
const TILES_FULL_ALTITUDE = 0.34
const SEGMENTS = 12
// Tiles kept in memory (each ~340 KB of GPU memory with its mipmaps)
const CACHE_SIZE = { phone: 56, desktop: 110 }
const CONCURRENT = 6
const FADE_MS = 320
const MAX_LAT = 85.0511
const TEXEL_PX = 1.3 // allow a tile pixel to cover ~1.3 CSS px (sharp enough, fewer tiles)

const tileLng = (x, z) => (x / 2 ** z) * 360 - 180
const tileLat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return (180 / Math.PI) * Math.atan(Math.sinh(n))
}
const lngToX = (lng, z) => Math.floor((((lng + 180) / 360) % 1 + 1) % 1 * 2 ** z)
const latToY = (lat, z) => {
  const r = (clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
  return clamp(Math.floor(y), 0, 2 ** z - 1)
}
const keyOf = (z, x, y) => `${z}/${x}/${y}`

function tileGeometry(z, x, y) {
  const n = SEGMENTS + 1
  const positions = new Float32Array(n * n * 3)
  const normals = new Float32Array(n * n * 3)
  const uvs = new Float32Array(n * n * 2)
  const lls = new Float32Array(n * n * 2)
  const v = new THREE.Vector3()
  for (let j = 0; j < n; j++) {
    // Evenly spaced in Mercator y, so texture rows land where they belong
    const lat = tileLat(y + j / SEGMENTS, z)
    for (let i = 0; i < n; i++) {
      const lng = tileLng(x + i / SEGMENTS, z)
      toVector(lat, lng, 0, v)
      const k = j * n + i
      positions.set([v.x, v.y, v.z], k * 3)
      v.normalize()
      normals.set([v.x, v.y, v.z], k * 3)
      uvs.set([i / SEGMENTS, 1 - j / SEGMENTS], k * 2)
      lls.set([lng, lat], k * 2)
    }
  }
  const index = []
  for (let j = 0; j < SEGMENTS; j++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = j * n + i
      const b = a + n
      index.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('aLatLng', new THREE.BufferAttribute(lls, 2))
  geometry.setIndex(index)
  geometry.computeBoundingSphere()
  return geometry
}

export class NightTiles {
  // uniforms: shared with the globe's shader ({ uGrid })
  constructor(renderer, uniforms, { phone = false } = {}) {
    this.renderer = renderer
    this.uniforms = uniforms
    this.cacheSize = phone ? CACHE_SIZE.phone : CACHE_SIZE.desktop
    // (No renderOrder on the group: a group's order outranks its children's,
    // and the tiles must draw before the markers, not after everything)
    this.group = new THREE.Group()
    this.cache = new Map() // key → entry
    this.inflight = 0
    this.queue = []
    this.level = null
    this.alpha = 0
    this.failures = 0
    this.loaded = 0
    this.disabled = false
    this.lastPlan = { at: 0, x: NaN, y: NaN, z: NaN, alt: NaN }
    this.desired = []
    this.shown = new Set()
    this.onLoad = null
  }

  entry(z, x, y) {
    const key = keyOf(z, x, y)
    let entry = this.cache.get(key)
    if (!entry) {
      entry = { key, z, x, y, state: 'idle', texture: null, mesh: null, readyAt: 0, used: 0, retryAt: 0 }
      this.cache.set(key, entry)
    }
    return entry
  }

  load(entry, now) {
    entry.state = 'loading'
    this.inflight++
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    const done = () => {
      this.inflight--
      image.onload = null
      image.onerror = null
    }
    image.onload = () => {
      done()
      if (this.disposed) return
      const texture = new THREE.Texture(image)
      // Raw values: the tile shader reads the file's own numbers
      texture.colorSpace = THREE.NoColorSpace
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
      texture.needsUpdate = true
      entry.texture = texture
      entry.state = 'ready'
      entry.readyAt = performance.now()
      this.loaded++
      this.failures = 0
      this.onLoad?.()
    }
    image.onerror = () => {
      done()
      entry.state = 'error'
      entry.retryAt = now + 20000
      this.failures++
      // Unreachable (offline, blocked, GIBS down): stop asking this session
      if (this.failures >= 10 && this.loaded === 0) this.disabled = true
    }
    image.src = tileUrl(entry.z, entry.x, entry.y)
  }

  mesh(entry) {
    if (!entry.mesh) {
      const material = new THREE.MeshPhongMaterial({
        map: entry.texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
      applyNightTileLook(material, this.uniforms)
      entry.mesh = new THREE.Mesh(tileGeometry(entry.z, entry.x, entry.y), material)
      entry.mesh.renderOrder = 1 + entry.z * 0.05
      entry.mesh.visible = false
      this.group.add(entry.mesh)
    }
    return entry.mesh
  }

  // What the screen needs: the level for its pixel size, and every tile a
  // grid of screen points lands on (nearest the middle first)
  plan(camera, size, altitude) {
    camera.updateMatrixWorld()
    const centre = surfacePoint(camera, size.w / 2, size.h / 2, size.w, size.h)
    if (!centre) return []
    const { lat } = toLatLng(centre)
    const kmPx = (altitude * EARTH_KM * 2 * Math.tan((25 * Math.PI) / 180)) / Math.max(1, size.h)
    const texelKm = kmPx * TEXEL_PX
    const ideal = Math.log2((40075 * Math.max(0.05, Math.cos((lat * Math.PI) / 180))) / (256 * texelKm))
    // Hysteresis: stay on the current level until the ideal is well past it
    let z = this.level
    if (z == null || ideal > z + 0.75 || ideal < z - 0.45) z = Math.round(ideal)
    z = clamp(z, MIN_LEVEL, MAX_LEVEL)
    this.level = z
    const found = new Map()
    const step = 90
    const nx = Math.ceil(size.w / step) + 1
    const ny = Math.ceil(size.h / step) + 1
    const p = new THREE.Vector3()
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const sx = (i / (nx - 1)) * size.w
        const sy = (j / (ny - 1)) * size.h
        if (!surfacePoint(camera, sx, sy, size.w, size.h, p)) continue
        const ll = toLatLng(p)
        if (Math.abs(ll.lat) > MAX_LAT) continue
        const x = lngToX(ll.lng, z)
        const y = latToY(ll.lat, z)
        const key = keyOf(z, x, y)
        const d = Math.hypot(sx - size.w / 2, sy - size.h / 2)
        const known = found.get(key)
        if (!known || d < known.d) found.set(key, { z, x, y, d })
      }
    }
    return [...found.values()].sort((a, b) => a.d - b.d)
  }

  // A camera move is starting: ask for what the destination will need now,
  // ahead of anything else, so it's there (or on its way) when we arrive
  prefetch(camera, size, altitude) {
    if (this.disabled || altitude >= TILES_FROM_ALTITUDE) return
    const wanted = this.plan(camera, size, altitude)
    const fresh = wanted.filter(t => {
      const entry = this.cache.get(keyOf(t.z, t.x, t.y))
      return !entry || entry.state === 'idle'
    })
    const keys = new Set(fresh.map(t => keyOf(t.z, t.x, t.y)))
    this.queue = fresh.concat(this.queue.filter(t => !keys.has(keyOf(t.z, t.x, t.y))))
    // What's on screen at the end of the move is what matters now (the
    // flight doesn't re-plan until it's nearly there)
    this.desired = wanted
    this.lastPlan.at = performance.now()
    // Keep fetching even while the camera is still up high
    this.prefetchUntil = performance.now() + 5000
  }

  // One frame. active: tiles are wanted at all (not during the intro, etc.);
  // travelling: the camera is mid-flight (keep fetching, but don't re-plan
  // for places it's only passing over)
  update(now, dt, camera, size, altitude, active, travelling = false) {
    const want = active && !this.disabled && altitude < TILES_FROM_ALTITUDE
    const goal = want ? clamp((TILES_FROM_ALTITUDE - altitude) / (TILES_FROM_ALTITUDE - TILES_FULL_ALTITUDE), 0, 1) : 0
    this.alpha += (goal - this.alpha) * (1 - Math.exp(-Math.max(1, dt) / 140))
    if (Math.abs(goal - this.alpha) < 0.003) this.alpha = goal
    const prefetching = !this.disabled && now < (this.prefetchUntil || 0)
    if (!want && this.alpha <= 0) {
      if (this.shown.size) this.hideAll()
      if (prefetching) {
        this.fetch(now)
        return
      }
      this.queue = []
      this.desired = [] // plan afresh when the camera comes back down
      return
    }

    // Re-plan when the camera has moved (or every 400 ms)
    const cam = camera.position
    const last = this.lastPlan
    const movedFar = Math.hypot(cam.x - last.x, cam.y - last.y, cam.z - last.z) > Math.max(0.002, altitude * 100 * 0.04)
    const replan = movedFar || Math.abs(Math.log(altitude / last.alt)) > 0.08 || now - last.at > 400 || !this.desired.length
    if (want && replan && (!travelling || !this.desired.length) && now > (this.holdUntil || 0)) {
      this.desired = this.plan(camera, size, altitude)
      Object.assign(last, { at: now, x: cam.x, y: cam.y, z: cam.z, alt: altitude })
      this.queue = this.desired.filter(t => {
        const entry = this.cache.get(keyOf(t.z, t.x, t.y))
        return !entry || entry.state === 'idle' || (entry.state === 'error' && now > entry.retryAt)
      })
    }

    if (want || prefetching) this.fetch(now)

    // What to draw: each wanted tile if it's here, else its four children if
    // they all are, else its nearest loaded ancestor
    const show = new Map() // entry → opacity
    for (const t of this.desired) {
      const entry = this.cache.get(keyOf(t.z, t.x, t.y))
      if (entry) entry.used = now
      const fade = entry?.state === 'ready' ? clamp((now - entry.readyAt) / FADE_MS, 0, 1) : 0
      if (fade >= 1) {
        show.set(entry, 1)
        continue
      }
      if (fade > 0) show.set(entry, fade)
      const kids = []
      if (t.z < MAX_LEVEL) {
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const kid = this.cache.get(keyOf(t.z + 1, t.x * 2 + dx, t.y * 2 + dy))
          if (kid?.state === 'ready') kids.push(kid)
        }
      }
      if (kids.length === 4) {
        for (const kid of kids) {
          kid.used = now
          show.set(kid, Math.max(show.get(kid) || 0, 1))
        }
        continue
      }
      for (let up = 1; up <= t.z - MIN_LEVEL; up++) {
        const parent = this.cache.get(keyOf(t.z - up, t.x >> up, t.y >> up))
        if (parent?.state === 'ready') {
          parent.used = now
          show.set(parent, 1)
          break
        }
      }
    }

    // Apply
    for (const entry of this.shown) {
      if (!show.has(entry) && entry.mesh) entry.mesh.visible = false
    }
    this.shown = new Set(show.keys())
    for (const [entry, opacity] of show) {
      const mesh = this.mesh(entry)
      mesh.visible = true
      mesh.material.opacity = opacity * this.alpha
    }
    this.evict(now)
  }

  // Start the next fetches, nearest the middle first
  fetch(now) {
    while (this.inflight < CONCURRENT && this.queue.length) {
      const t = this.queue.shift()
      const entry = this.entry(t.z, t.x, t.y)
      if (entry.state === 'idle' || (entry.state === 'error' && now > entry.retryAt)) this.load(entry, now)
    }
  }

  hideAll() {
    for (const entry of this.shown) if (entry.mesh) entry.mesh.visible = false
    this.shown = new Set()
  }

  // Keep the cache small: drop the least recently used tiles not on screen
  evict() {
    if (this.cache.size <= this.cacheSize) return
    const idle = [...this.cache.values()]
      .filter(entry => entry.state !== 'loading' && !this.shown.has(entry))
      .sort((a, b) => a.used - b.used)
    for (const entry of idle.slice(0, this.cache.size - this.cacheSize)) this.drop(entry)
  }

  drop(entry) {
    if (entry.mesh) {
      this.group.remove(entry.mesh)
      entry.mesh.geometry.dispose()
      entry.mesh.material.dispose()
    }
    entry.texture?.dispose()
    this.cache.delete(entry.key)
  }

  get visible() {
    return this.alpha > 0.02 && this.shown.size > 0
  }

  dispose() {
    this.disposed = true
    for (const entry of [...this.cache.values()]) this.drop(entry)
  }
}
