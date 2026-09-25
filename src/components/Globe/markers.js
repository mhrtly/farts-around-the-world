// Every place with farts, drawn as one THREE.Points (one draw call however
// many places there are). Each dot is a crisp phosphor core with a tight glow;
// the per-dot state (lit, selected, dimmed, pulsing) lives in attributes the
// tick writes each frame. Picking happens in screen space on the CPU.
//
// The core is opaque (premultiplied alpha): it covers the sodium city light
// under it and a neighbour's glow, and a thin dark bezel just outside it keeps
// close dots and city lights apart. Only the glow adds light, so a cluster
// stays a cluster of dots instead of summing into one white blob.

import * as THREE from 'three'
import { GLOBE_RADIUS, clamp, damp, rgb, toVector } from './geo.js'

const MARKER_ALTITUDE = 0.006
const HOUR = 60 * 60 * 1000
const _v = new THREE.Vector3()
const _cam = new THREE.Vector3()

// Core diameter in CSS px, by number of farts at the place
export function coreSize(count) {
  return Math.min(11.5, 5.2 + Math.log2(Math.max(1, count)) * 1.55)
}

const vertexShader = `
  attribute float aSize;
  attribute vec4 aState;   // x: core brightness, y: core whiteness, z: glow scale, w: flash
  attribute float aGlow;   // glow gain
  uniform float uPixelRatio;
  uniform float uGlobeR;
  varying vec4 vState;
  varying float vGlow;
  varying float vFade;
  varying float vCore;
  varying float vRadius;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Fade out toward the horizon instead of popping behind the planet
    float camDist = length(cameraPosition);
    float horizon = dot(normalize(position), cameraPosition / camDist) - uGlobeR / camDist;
    vFade = smoothstep(-0.004, 0.035, horizon);
    vCore = aSize * 0.5;
    vRadius = vCore + 3.0 + 26.0 * aState.z;
    gl_PointSize = vRadius * 2.0 * uPixelRatio;
    vState = aState;
    vGlow = aGlow;
    if (vFade * aState.x <= 0.001) gl_PointSize = 0.0;
  }`

const fragmentShader = `
  uniform vec3 uColor;
  varying vec4 vState;
  varying float vGlow;
  varying float vFade;
  varying float vCore;
  varying float vRadius;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0 * vRadius;
    float core = 1.0 - smoothstep(vCore - 0.75, vCore + 0.75, r);
    float edge = max(r - vCore, 0.0);
    float g = max(vState.z, 0.05);
    float rim = (1.0 - smoothstep(1.2, 2.6, edge)) * 0.16;
    float glow = vGlow * (0.5 * exp(-edge / (2.6 * g)) + 0.12 * exp(-edge / (8.5 * g)));
    glow *= 1.0 - smoothstep(vRadius - 6.0, vRadius, r);
    float halo = (rim * min(1.0, vGlow * 1.6) + glow) * (1.0 - core);
    // A hot centre fading to phosphor at the edge, like a lit LED
    float centre = 1.0 - clamp(r / max(vCore, 1.0), 0.0, 1.0);
    vec3 coreColor = mix(uColor, vec3(1.0), clamp(vState.y + centre * centre * 0.55, 0.0, 1.0)) * vState.x;
    vec3 color = coreColor * core + uColor * halo;
    color += vState.w * (core + glow * 0.9) * vec3(1.0);
    float bezel = smoothstep(vCore + 0.1, vCore + 0.9, r) * (1.0 - smoothstep(vCore + 1.1, vCore + 2.3, r));
    float a = max(core * max(0.85, vState.x), bezel * 0.6);
    gl_FragColor = vec4(color, a) * vFade;
  }`

export class MarkerLayer {
  constructor(pixelRatio) {
    this.entries = []
    this.byKey = new Map()
    this.capacity = 0
    this.geometry = new THREE.BufferGeometry()
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: pixelRatio },
        uGlobeR: { value: GLOBE_RADIUS },
        uColor: { value: new THREE.Vector3(...rgb('#62f6d0')) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 20
    this.ensureCapacity(32)
  }

  ensureCapacity(count) {
    if (count <= this.capacity) return
    let capacity = Math.max(32, this.capacity)
    while (capacity < count) capacity *= 2
    this.capacity = capacity
    this.positions = new Float32Array(capacity * 3)
    this.sizes = new Float32Array(capacity)
    this.states = new Float32Array(capacity * 4)
    this.glows = new Float32Array(capacity)
    const position = new THREE.BufferAttribute(this.positions, 3)
    const size = new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage)
    const state = new THREE.BufferAttribute(this.states, 4).setUsage(THREE.DynamicDrawUsage)
    const glow = new THREE.BufferAttribute(this.glows, 1).setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('position', position)
    this.geometry.setAttribute('aSize', size)
    this.geometry.setAttribute('aState', state)
    this.geometry.setAttribute('aGlow', glow)
    this.writePositions()
  }

  writePositions() {
    this.entries.forEach((entry, i) => {
      this.positions[i * 3] = entry.pos.x
      this.positions[i * 3 + 1] = entry.pos.y
      this.positions[i * 3 + 2] = entry.pos.z
    })
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.setDrawRange(0, this.entries.length)
  }

  // Keeps each place's entry (and its lit state) across data refreshes.
  // Returns the entries that are new.
  setSites(sites) {
    const next = new Set(sites.map(site => site.key))
    const added = []
    let changed = false
    for (const entry of this.entries) {
      if (!next.has(entry.key)) {
        this.byKey.delete(entry.key)
        changed = true
      }
    }
    if (changed) this.entries = this.entries.filter(entry => next.has(entry.key))
    for (const site of sites) {
      let entry = this.byKey.get(site.key)
      if (!entry) {
        entry = {
          key: site.key,
          site,
          pos: toVector(site.lat, site.lng, MARKER_ALTITUDE),
          bornAt: null,
          dim: 1,
          sel: 0,
          hl: 0,
          phase: Math.random() * Math.PI * 2,
        }
        this.byKey.set(site.key, entry)
        this.entries.push(entry)
        added.push(entry)
        changed = true
      }
      entry.site = site
      entry.count = site.events.length
      entry.oldest = site.events.length ? site.events[site.events.length - 1].timestamp : site.latest
    }
    if (changed) {
      this.ensureCapacity(this.entries.length)
      this.writePositions()
    }
    return added
  }

  get(key) {
    return key ? this.byKey.get(key) || null : null
  }

  // ctx: { selectedKey, highlightKey, playingKey, level, dimmed, scale }
  // Returns entries that switched on this frame (for their ignition ring).
  update(now, dt, ctx) {
    const ignited = []
    const wall = Date.now()
    const { states, sizes, glows } = this
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i]
      const o = i * 4
      if (e.bornAt == null || now < e.bornAt) {
        states[o] = 0
        continue
      }
      if (!e.lit) {
        e.lit = true
        ignited.push(e)
      }
      // On instantly with a one-frame white flash, then settle to phosphor
      // (flashAt re-fires it when another fart lands on the same place)
      const flashAge = now - Math.max(e.bornAt, e.flashAt ?? e.bornAt)
      if (e.quiet && flashAge > 400) e.quiet = false // only the switch-on itself is quiet
      const flash = e.quiet || flashAge < 0 ? 0 : flashAge < 34 ? 1 : 0.55 * Math.exp(-(flashAge - 34) / 160)
      const isSel = e.key === ctx.selectedKey
      const isHl = e.key === ctx.highlightKey
      const isPlaying = e.key === ctx.playingKey
      e.sel = damp(e.sel, isSel ? 1 : 0, dt, 60)
      e.hl = damp(e.hl, isHl ? 1 : 0, dt, 80)
      // While something is selected the others step back: their glow drops
      // away but the core stays phosphor, so they still read as farts
      const target = ctx.selectedKey && !isSel && !isHl && !isPlaying ? 0.4 : 1
      e.dim = damp(e.dim, target, dt, 110)
      e.fresh = wall - e.site.latest < HOUR
      const breathe = 1 + Math.sin(now / 1100 + e.phase) * 0.05
      const level = isPlaying ? ctx.level : 0
      const shrink = ctx.selectedKey && !isSel ? 0.9 : 1
      const recorder = ctx.dimmed ? 0.6 : 1
      sizes[i] = coreSize(e.count) * ctx.scale * (1 + 0.22 * e.sel + 0.18 * e.hl) * shrink * (1 + level * 0.18)
      states[o] = recorder * clamp(0.8 + 0.12 * e.dim + 0.08 * e.sel + level * 0.3, 0, 1.25)
      states[o + 1] = 0.26 + 0.74 * Math.max(e.sel, level)
      states[o + 2] = (1 + 0.3 * e.sel + 0.25 * e.hl) * breathe * (1 + level * 1.1)
      states[o + 3] = flash
      glows[i] = recorder * e.dim * (0.64 + 0.36 * Math.max(e.sel, e.hl) + level * 0.5)
    }
    this.geometry.attributes.aSize.needsUpdate = true
    this.geometry.attributes.aState.needsUpdate = true
    this.geometry.attributes.aGlow.needsUpdate = true
    return ignited
  }

  // 0..1: how far a place is in front of the horizon (0 = behind the planet)
  static facing(pos, camera) {
    _cam.copy(camera.position)
    const dist = _cam.length()
    return (_v.copy(pos).normalize().dot(_cam.divideScalar(dist)) - GLOBE_RADIUS / dist) / 0.035
  }

  // Screen position (canvas px) of a world point, or null behind the planet
  static project(pos, camera, width, height) {
    if (MarkerLayer.facing(pos, camera) < 0.25) return null
    _v.copy(pos).project(camera)
    return { x: ((_v.x + 1) / 2) * width, y: ((1 - _v.y) / 2) * height }
  }

  // Nearest lit place to a canvas point within `radius` px. Places within
  // 3 px of the nearest count as a tie: the selected one wins, then the
  // busier one, then the nearer one.
  pick(x, y, radius, camera, width, height, selectedKey) {
    const hits = []
    let nearest = Infinity
    for (const e of this.entries) {
      if (!e.lit) continue
      const p = MarkerLayer.project(e.pos, camera, width, height)
      if (!p) continue
      const d = Math.hypot(p.x - x, p.y - y)
      if (d > radius) continue
      hits.push({ e, d })
      nearest = Math.min(nearest, d)
    }
    let best = null
    for (const hit of hits) {
      if (hit.d > nearest + 3) continue
      if (!best) {
        best = hit
        continue
      }
      const sel = (hit.e.key === selectedKey) - (best.e.key === selectedKey)
      if (sel > 0 || (sel === 0 && (hit.e.count > best.e.count || (hit.e.count === best.e.count && hit.d < best.d)))) best = hit
    }
    return best?.e || null
  }

  // The lit places drawn on top of (within `px` of) this one, itself
  // included, in a stable order, so repeat taps can step through them
  overlapping(entry, px, camera, width, height) {
    const at = MarkerLayer.project(entry.pos, camera, width, height)
    if (!at) return [entry]
    const group = []
    for (const e of this.entries) {
      if (!e.lit) continue
      if (e === entry) {
        group.push(e)
        continue
      }
      const p = MarkerLayer.project(e.pos, camera, width, height)
      if (p && Math.hypot(p.x - at.x, p.y - at.y) <= px) group.push(e)
    }
    return group.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
