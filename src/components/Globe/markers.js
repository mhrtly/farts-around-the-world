// Every recording as a point of light, all in one THREE.Points (one draw
// call however many there are). Recordings that share a marker at the
// current zoom converge on it and only its lead is drawn, sized by how many
// it holds. As the camera closes in, markers split apart, and a spot of
// several farts blooms into a ring of petals around a pin, one petal per
// fart, joined to the pin by hairlines. Every regrouping is animated: dots
// glide apart, or together, over ~0.45 s.
//
// A dot is a crisp phosphor core with a tight glow; its state (lit,
// selected, dimmed, pulsing) lives in attributes the tick writes each frame.
// The core is opaque (premultiplied alpha): it covers the sodium city light
// under it and a neighbour's glow, and a thin dark bezel just outside it
// keeps close dots and city lights apart. Picking happens in screen space.

import * as THREE from 'three'
import { GLOBE_RADIUS, TAN_HALF_FOV, clamp, damp, lightBlending, rgb } from './geo.js'
import { Grouping, MAX_PETALS, buildSpots, petalLayout } from './clusters.js'

// ~200 m up: on the ground even at town level (the camera gets to ~12 km)
export const MARKER_ALTITUDE = 0.00003
const MARKER_RADIUS = GLOBE_RADIUS * (1 + MARKER_ALTITUDE)
const HOUR = 60 * 60 * 1000
const MOVE_MS = 460
const _v = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _pin = new THREE.Vector3()

// Core diameter in CSS px, by number of farts at the marker
export function coreSize(count) {
  return Math.min(11.5, 5.2 + Math.log2(Math.max(1, count)) * 1.55)
}

const easeOutCubic = t => 1 - (1 - t) ** 3
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
// A petal springs out with a little overshoot, like a flower opening
const easeOutBack = t => {
  const c1 = 1.25
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

const vertexShader = `
  attribute float aSize;
  attribute vec4 aState;   // x: core brightness, y: core whiteness, z: glow scale, w: flash
  attribute float aGlow;   // glow gain
  attribute float aAlpha;  // regrouping fade
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
    // Fade out toward the horizon instead of popping behind the planet. The
    // band is a slice of the visible cap, which shrinks as the camera comes
    // down (at 25 km up the whole cap is only ~5° across).
    float camDist = length(cameraPosition);
    float horizon = dot(normalize(position), cameraPosition / camDist) - uGlobeR / camDist;
    float band = min(0.035, 0.1 * (1.0 - uGlobeR / camDist));
    vFade = smoothstep(-0.12 * band, band, horizon) * aAlpha;
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

// The pin at the centre of a bloom: a small hollow ring on the exact spot
const pinVertex = `
  attribute float aAlpha;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vAlpha = aAlpha;
    gl_PointSize = aAlpha > 0.001 ? 14.0 * uPixelRatio : 0.0;
  }`
const pinFragment = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 14.0;
    float ring = 1.0 - smoothstep(0.5, 1.3, abs(r - 3.2));
    float dot = 1.0 - smoothstep(0.6, 1.4, r);
    gl_FragColor = vec4(uColor * (ring * 0.75 + dot * 0.5) * vAlpha, 1.0);
  }`

// Hairlines from the pin to each petal
const lineVertex = `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`
const lineFragment = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor * vAlpha, 1.0);
  }`

function sameTarget(a, b) {
  return a && b &&
    Math.abs(a.ox - b.ox) < 0.01 && Math.abs(a.oy - b.oy) < 0.01 &&
    Math.abs(a.size - b.size) < 0.01 && a.alpha === b.alpha &&
    a.dir.dot(b.dir) > 1 - 1e-13
}

export class MarkerLayer {
  constructor(pixelRatio) {
    this.items = []
    this.byId = new Map()
    this.spots = []
    this.spotByKey = new Map()
    this.grouping = new Grouping()
    this.nodes = []
    this.nodeById = new Map()
    this.blooms = new Map() // spot key → { t } bloom progress (pin and hairlines)
    this.layoutVersion = -1
    this.capacity = 0
    const phosphor = new THREE.Vector3(...rgb('#62f6d0'))

    this.geometry = new THREE.BufferGeometry()
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: pixelRatio },
        uGlobeR: { value: GLOBE_RADIUS },
        uColor: { value: phosphor },
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

    this.pinGeometry = new THREE.BufferGeometry()
    this.pinMaterial = lightBlending(new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: pixelRatio }, uColor: { value: phosphor } },
      vertexShader: pinVertex,
      fragmentShader: pinFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }))
    this.pins = new THREE.Points(this.pinGeometry, this.pinMaterial)
    this.pins.frustumCulled = false
    this.pins.renderOrder = 19

    this.lineGeometry = new THREE.BufferGeometry()
    this.lineMaterial = lightBlending(new THREE.ShaderMaterial({
      uniforms: { uColor: { value: phosphor } },
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }))
    this.lines = new THREE.LineSegments(this.lineGeometry, this.lineMaterial)
    this.lines.frustumCulled = false
    this.lines.renderOrder = 19

    this.group = new THREE.Group()
    this.group.add(this.lines, this.pins, this.points)
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
    this.alphas = new Float32Array(capacity)
    const dynamic = attribute => attribute.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('position', dynamic(new THREE.BufferAttribute(this.positions, 3)))
    this.geometry.setAttribute('aSize', dynamic(new THREE.BufferAttribute(this.sizes, 1)))
    this.geometry.setAttribute('aState', dynamic(new THREE.BufferAttribute(this.states, 4)))
    this.geometry.setAttribute('aGlow', dynamic(new THREE.BufferAttribute(this.glows, 1)))
    this.geometry.setAttribute('aAlpha', dynamic(new THREE.BufferAttribute(this.alphas, 1)))
    // Pins: one per spot at most; hairlines: two vertices per recording
    this.pinPositions = new Float32Array(capacity * 3)
    this.pinAlphas = new Float32Array(capacity)
    this.pinGeometry.setAttribute('position', dynamic(new THREE.BufferAttribute(this.pinPositions, 3)))
    this.pinGeometry.setAttribute('aAlpha', dynamic(new THREE.BufferAttribute(this.pinAlphas, 1)))
    this.linePositions = new Float32Array(capacity * 6)
    this.lineAlphas = new Float32Array(capacity * 2)
    this.lineGeometry.setAttribute('position', dynamic(new THREE.BufferAttribute(this.linePositions, 3)))
    this.lineGeometry.setAttribute('aAlpha', dynamic(new THREE.BufferAttribute(this.lineAlphas, 1)))
  }

  // Keeps each recording's item (and its lit state) across data refreshes.
  // Returns the items that are new.
  setSites(sites) {
    const spots = buildSpots(sites)
    const seen = new Set()
    const added = []
    this.spotByKey = new Map(spots.map(spot => [spot.key, spot]))
    for (const spot of spots) {
      for (const event of spot.events) {
        seen.add(event.id)
        let item = this.byId.get(event.id)
        if (!item) {
          item = {
            id: event.id,
            bornAt: null,
            flashAt: null,
            lit: false,
            quiet: false,
            phase: Math.random() * Math.PI * 2,
            from: null,
            to: null,
            t0: 0,
            dur: 0,
            ease: easeOutCubic,
            pos: new THREE.Vector3(),
            dir: spot.dir.clone(),
            ox: 0,
            oy: 0,
            size: 0,
            alpha: 0,
            node: null,
          }
          this.byId.set(event.id, item)
          added.push(item)
        }
        item.event = event
        item.spot = spot
      }
    }
    if (seen.size !== this.byId.size) {
      for (const id of [...this.byId.keys()]) if (!seen.has(id)) this.byId.delete(id)
    }
    this.items = [...this.byId.values()]
    this.spots = spots
    this.grouping.setSpots(spots)
    this.ensureCapacity(Math.max(this.items.length, spots.length))
    return added
  }

  get(id) {
    return id ? this.byId.get(id) || null : null
  }

  spot(key) {
    return key ? this.spotByKey.get(key) || null : null
  }

  // The marker a recording is drawn in right now (its own petal or dot, or
  // the cluster it's part of)
  nodeOf(id) {
    return id ? this.nodeById.get(id) || null : null
  }

  // ctx: { scale (km/px), mergePx, bloomMaxScale, bloomNeed, petalSpacing,
  //        petalSize, dotScale, reduced }
  layout(now, ctx) {
    const changed = this.grouping.update(ctx.scale, ctx)
    if (!changed && this.layoutVersion === this.grouping.version && ctx.dotScale === this.lastDotScale && ctx.petalSpacing === this.lastSpacing) return false
    this.layoutVersion = this.grouping.version
    this.lastDotScale = ctx.dotScale
    this.lastSpacing = ctx.petalSpacing
    const nodes = []
    const nodeById = new Map()
    const target = (item, dir, ox, oy, size, alpha, style) => {
      const next = { dir, ox, oy, size, alpha }
      if (sameTarget(item.to, next)) return
      if (!item.to || ctx.reduced) {
        // First placement: straight there
        item.from = next
        item.to = next
        item.t0 = now
        item.dur = 0
        return
      }
      item.from = this.displayState(item, now)
      item.to = next
      item.t0 = now
      item.dur = MOVE_MS
      item.ease = style === 'out' ? easeOutBack : style === 'in' ? easeInOutCubic : easeOutCubic
    }
    for (const group of this.grouping.groups) {
      if (group.bloom) {
        const spot = group.lead
        const { positions } = petalLayout(spot.count, ctx.petalSpacing)
        const shown = spot.chronological.slice(-MAX_PETALS)
        const hidden = spot.chronological.slice(0, Math.max(0, spot.count - MAX_PETALS))
        shown.forEach((event, i) => {
          const item = this.byId.get(event.id)
          if (!item) return
          const p = positions[i]
          target(item, spot.dir, p.x, p.y, ctx.petalSize, 1, 'out')
          const node = { key: `p:${item.id}`, kind: 'petal', lead: item, items: [item], ids: [item.id], count: 1, spot, number: spot.count - shown.length + i + 1, sel: 0, hl: 0, dim: 1 }
          nodes.push(node)
          nodeById.set(item.id, node)
        })
        for (const event of hidden) {
          const item = this.byId.get(event.id)
          if (item) target(item, spot.dir, 0, 0, ctx.petalSize, 0, 'in')
        }
        continue
      }
      const kind = group.count === 1 ? 'single' : 'cluster'
      const lead = this.byId.get(group.lead.events[0].id)
      const items = group.events.map(event => this.byId.get(event.id)).filter(Boolean)
      const size = coreSize(group.count) * ctx.dotScale
      for (const item of items) target(item, group.dir, 0, 0, size, item === lead ? 1 : 0, 'in')
      const node = { key: group.key, kind, lead, items, ids: items.map(item => item.id), count: group.count, group, spot: group.lead, sel: 0, hl: 0, dim: 1 }
      nodes.push(node)
      for (const item of items) nodeById.set(item.id, node)
    }
    // Carry each node's damped highlight state over to its successor
    for (const node of nodes) {
      const previous = this.nodeById.get(node.lead.id)
      if (previous) {
        node.sel = previous.sel
        node.hl = previous.hl
        node.dim = previous.dim
      }
    }
    this.nodes = nodes
    this.nodeById = nodeById
    for (const node of nodes) for (const item of node.items) item.node = node
    return true
  }

  // Where an item is on its way between two placements, written into `out`
  // (a new object when none is given)
  displayState(item, now, out = { dir: new THREE.Vector3(), ox: 0, oy: 0, size: 0, alpha: 0 }) {
    const from = item.from
    const to = item.to
    if (!from || !to) {
      out.dir.copy(item.dir)
      out.ox = 0
      out.oy = 0
      out.size = 0
      out.alpha = 0
      return out
    }
    const t = item.dur > 0 ? clamp((now - item.t0) / item.dur, 0, 1) : 1
    const e = t >= 1 ? 1 : item.ease(t)
    if (from === to || t >= 1) out.dir.copy(to.dir)
    else out.dir.copy(from.dir).lerp(to.dir, clamp(e, 0, 1.3)).normalize()
    const fade = to.alpha >= from.alpha ? Math.min(1, t * 2.4) : t * t * t
    out.ox = from.ox + (to.ox - from.ox) * e
    out.oy = from.oy + (to.oy - from.oy) * e
    out.size = from.size + (to.size - from.size) * Math.min(1, t * 1.6)
    out.alpha = from.alpha + (to.alpha - from.alpha) * fade
    return out
  }

  moving(now) {
    for (const item of this.items) if (item.dur > 0 && now - item.t0 < item.dur) return true
    return false
  }

  // Places every item for this frame (camera-dependent petal offsets) and
  // writes the draw state. ctx: { selectedId, highlightId, playingId, level,
  // dimmed, viewportHeight }. Returns the nodes that switched on this frame.
  update(now, dt, camera, ctx) {
    const ignited = []
    const wall = Date.now()
    const { states, sizes, glows, alphas, positions } = this
    camera.updateMatrixWorld()
    _cam.setFromMatrixPosition(camera.matrixWorld)
    _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    _up.setFromMatrixColumn(camera.matrixWorld, 1).normalize()
    _fwd.setFromMatrixColumn(camera.matrixWorld, 2).normalize().negate()
    const worldPerPxAt1 = (2 * TAN_HALF_FOV) / Math.max(1, ctx.viewportHeight)

    // Lifecycle: switch-ons and flashes, per item
    for (const item of this.items) {
      if (item.bornAt == null || now < item.bornAt) continue
      if (!item.lit) {
        item.lit = true
        item.justLit = true
      }
    }

    // Positions
    const s = this.scratch || (this.scratch = { dir: new THREE.Vector3(), ox: 0, oy: 0, size: 0, alpha: 0 })
    this.items.forEach((item, i) => {
      this.displayState(item, now, s)
      item.dir.copy(s.dir)
      item.ox = s.ox
      item.oy = s.oy
      item.size = s.size
      item.alpha = s.alpha
      item.pos.copy(s.dir).multiplyScalar(MARKER_RADIUS)
      if (s.ox || s.oy) {
        const depth = Math.max(0.01, _v.copy(item.pos).sub(_cam).dot(_fwd))
        const wpp = depth * worldPerPxAt1
        item.pos.addScaledVector(_right, s.ox * wpp).addScaledVector(_up, s.oy * wpp)
      }
      positions[i * 3] = item.pos.x
      positions[i * 3 + 1] = item.pos.y
      positions[i * 3 + 2] = item.pos.z
      states[i * 4] = 0
      alphas[i] = 0
      sizes[i] = 0
      glows[i] = 0
    })
    const indexOf = new Map(this.items.map((item, i) => [item, i]))

    // Draw state, per marker
    const selectedNode = this.nodeOf(ctx.selectedId)
    const highlightNode = this.nodeOf(ctx.highlightId)
    const playingNode = this.nodeOf(ctx.playingId)
    for (const node of this.nodes) {
      const lead = node.lead
      let lit = false
      let flash = 0
      let fresh = false
      let justLit = false
      for (const item of node.items) {
        if (!item.lit) continue
        lit = true
        if (item.justLit) justLit = true
        const flashAge = now - Math.max(item.bornAt, item.flashAt ?? item.bornAt)
        if (item.quiet && flashAge > 400) item.quiet = false // only the switch-on itself is quiet
        const f = item.quiet || flashAge < 0 ? 0 : flashAge < 34 ? 1 : 0.55 * Math.exp(-(flashAge - 34) / 160)
        flash = Math.max(flash, f)
        if (wall - (item.event?.timestamp || 0) < HOUR) fresh = true
      }
      node.lit = lit
      node.fresh = lit && fresh
      if (justLit && !node.items.every(item => item.quiet)) ignited.push(node)
      const isSel = node === selectedNode
      const isHl = node === highlightNode
      const isPlaying = node === playingNode
      node.sel = damp(node.sel, isSel ? 1 : 0, dt, 60)
      node.hl = damp(node.hl, isHl ? 1 : 0, dt, 80)
      // While something is selected the others step back: their glow drops
      // away but the core stays phosphor, so they still read as farts
      const dimTarget = ctx.selectedId && !isSel && !isHl && !isPlaying ? 0.4 : 1
      node.dim = damp(node.dim, dimTarget, dt, 110)
      if (!lit) continue
      const breathe = 1 + Math.sin(now / 1100 + lead.phase) * 0.05
      const level = isPlaying ? ctx.level : 0
      const shrink = ctx.selectedId && !isSel ? 0.9 : 1
      const recorder = ctx.dimmed ? 0.6 : 1
      const size = (1 + 0.22 * node.sel + 0.18 * node.hl) * shrink * (1 + level * 0.18)
      const brightness = recorder * clamp(0.8 + 0.12 * node.dim + 0.08 * node.sel + level * 0.3, 0, 1.25)
      const white = 0.26 + 0.74 * Math.max(node.sel, level)
      const glowScale = (1 + 0.3 * node.sel + 0.25 * node.hl) * breathe * (1 + level * 1.1)
      const glow = recorder * node.dim * (0.64 + 0.36 * Math.max(node.sel, node.hl) + level * 0.5)
      // Every member draws with the marker's state (most are invisible:
      // only the lead is, and anything still gliding in or out). If the lead
      // isn't switched on yet (a newer fart still on its way in), a lit
      // member stands in for it.
      const standIn = lead.lit ? null : node.items.find(item => item.lit)
      for (const item of node.items) {
        const i = indexOf.get(item)
        if (i === undefined) continue
        if (item === standIn) {
          sizes[i] = lead.size * size
          states[i * 4] = brightness
          states[i * 4 + 1] = white
          states[i * 4 + 2] = glowScale
          states[i * 4 + 3] = flash
          glows[i] = glow
          alphas[i] = Math.max(item.alpha, lead.alpha)
          continue
        }
        if (item.alpha <= 0.002 || !item.lit) continue
        const o = i * 4
        sizes[i] = item.size * size
        states[o] = brightness
        states[o + 1] = white
        states[o + 2] = glowScale
        states[o + 3] = flash
        glows[i] = glow
        alphas[i] = item.alpha
      }
    }
    for (const item of this.items) item.justLit = false

    // Blooms: the pin and a hairline to each petal
    const bloomKeys = this.grouping.bloomed
    for (const key of bloomKeys) if (!this.blooms.has(key)) this.blooms.set(key, { t: 0 })
    let pinCount = 0
    let lineCount = 0
    for (const [key, bloom] of this.blooms) {
      bloom.t = damp(bloom.t, bloomKeys.has(key) ? 1 : 0, dt, bloomKeys.has(key) ? 140 : 90)
      const spot = this.spotByKey.get(key)
      if (!spot || (bloom.t < 0.01 && !bloomKeys.has(key))) {
        this.blooms.delete(key)
        continue
      }
      const recorder = ctx.dimmed ? 0.6 : 1
      _pin.copy(spot.dir).multiplyScalar(MARKER_RADIUS)
      const lit = spot.events.some(event => this.byId.get(event.id)?.lit)
      if (!lit) continue
      this.pinPositions.set([_pin.x, _pin.y, _pin.z], pinCount * 3)
      this.pinAlphas[pinCount] = bloom.t * 0.9 * recorder
      pinCount++
      for (const event of spot.events) {
        const item = this.byId.get(event.id)
        if (!item || item.alpha <= 0.01 || !(item.ox || item.oy)) continue
        const o = lineCount * 6
        this.linePositions[o] = _pin.x
        this.linePositions[o + 1] = _pin.y
        this.linePositions[o + 2] = _pin.z
        this.linePositions[o + 3] = item.pos.x
        this.linePositions[o + 4] = item.pos.y
        this.linePositions[o + 5] = item.pos.z
        const node = item.node
        const a = item.alpha * bloom.t * recorder * (node && node === selectedNode ? 0.6 : 0.26)
        this.lineAlphas[lineCount * 2] = a * 0.35
        this.lineAlphas[lineCount * 2 + 1] = a
        lineCount++
      }
    }
    this.pinGeometry.setDrawRange(0, pinCount)
    this.lineGeometry.setDrawRange(0, lineCount * 2)
    for (const name of ['position', 'aAlpha']) {
      this.pinGeometry.attributes[name].needsUpdate = true
      this.lineGeometry.attributes[name].needsUpdate = true
    }

    this.geometry.setDrawRange(0, this.items.length)
    for (const name of ['position', 'aSize', 'aState', 'aGlow', 'aAlpha']) this.geometry.attributes[name].needsUpdate = true
    return ignited
  }

  // How far a point is in front of the horizon, in fade bands (≤ 0: behind
  // the planet; ≥ 1: fully in view). Same band as the shader.
  static facing(pos, camera) {
    _cam.copy(camera.position)
    const dist = _cam.length()
    const band = Math.min(0.035, 0.1 * (1 - GLOBE_RADIUS / dist))
    return (_v.copy(pos).normalize().dot(_cam.divideScalar(dist)) - GLOBE_RADIUS / dist) / band
  }

  // Screen position (canvas px) of a world point, or null behind the planet
  static project(pos, camera, width, height) {
    if (MarkerLayer.facing(pos, camera) < 0.25) return null
    _v.copy(pos).project(camera)
    return { x: ((_v.x + 1) / 2) * width, y: ((1 - _v.y) / 2) * height }
  }

  // Drawn size of a marker (core diameter, CSS px) right now
  static drawnSize(node) {
    return node ? node.lead.size * (1 + 0.22 * node.sel + 0.18 * node.hl) : 0
  }

  // The marker nearest a canvas point within `radius` px (petals: within
  // most of the gap to their neighbours). Markers within 3 px of the
  // nearest count as a tie: the selected one wins, then the busier one.
  pick(x, y, radius, camera, width, height, selectedId, petalRadius = radius) {
    const hits = []
    let nearest = Infinity
    for (const node of this.nodes) {
      if (!node.lit || node.lead.alpha < 0.5) continue
      const p = MarkerLayer.project(node.lead.pos, camera, width, height)
      if (!p) continue
      const d = Math.hypot(p.x - x, p.y - y)
      if (d > (node.kind === 'petal' ? petalRadius : radius)) continue
      hits.push({ node, d })
      nearest = Math.min(nearest, d)
    }
    let best = null
    for (const hit of hits) {
      if (hit.d > nearest + 3) continue
      if (!best) {
        best = hit
        continue
      }
      const holds = h => (selectedId && h.node.ids.includes(selectedId) ? 1 : 0)
      const sel = holds(hit) - holds(best)
      if (sel > 0 || (sel === 0 && (hit.node.count > best.node.count || (hit.node.count === best.node.count && hit.d < best.d)))) best = hit
    }
    return best?.node || null
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.pinGeometry.dispose()
    this.pinMaterial.dispose()
    this.lineGeometry.dispose()
    this.lineMaterial.dispose()
  }
}
