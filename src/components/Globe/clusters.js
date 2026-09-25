// Which recordings share a marker at the current zoom.
//
// A spot is every recording at one rounded coordinate (the server rounds to
// ~1 km, so a spot is as precise as the map gets). The minimum spanning tree
// of the spots' great-circle distances (single-linkage clustering) says what
// merges at a given scale: two spots share a marker while they'd be closer
// than `mergePx` on screen. A spot of several recordings "blooms" into a ring
// of petals, one per fart, once there's room for the ring around it.
//
// Pure bookkeeping (no drawing): markers.js turns groups into dots.

import * as THREE from 'three'
import { siteKey } from '../../utils/recordings.js'
import { arcKm, toVector } from './geo.js'

// Petals past this many aren't drawn one by one (the deck lists them all)
export const MAX_PETALS = 40

export function buildSpots(sites) {
  const byKey = new Map()
  for (const site of sites) {
    for (const event of site.events) {
      const lat = Number(event.lat)
      const lng = Number(event.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const key = siteKey(lat, lng)
      let spot = byKey.get(key)
      if (!spot) {
        const [kLat, kLng] = key.split(',').map(Number)
        spot = {
          key,
          lat: kLat,
          lng: kLng,
          dir: toVector(kLat, kLng, 0).normalize(),
          events: [],
          place: null,
          latest: 0,
          oldest: Infinity,
        }
        byKey.set(key, spot)
      }
      spot.events.push(event)
      if (!spot.place) spot.place = event.place || null
      if (!spot.place && site.place) spot.fallbackPlace = site.place
      spot.latest = Math.max(spot.latest, event.timestamp || 0)
      spot.oldest = Math.min(spot.oldest, event.timestamp || 0)
    }
  }
  const spots = [...byKey.values()]
  for (const spot of spots) {
    spot.events.sort((a, b) => b.timestamp - a.timestamp) // newest first
    // Oldest first, the way the deck numbers them (1 = the first one here)
    spot.chronological = [...spot.events].reverse()
    spot.count = spot.events.length
    spot.place = spot.place || spot.fallbackPlace || null
  }
  return spots
}

// Prim's algorithm on dot products (n ≤ a few hundred, once per data change)
function spanningTree(spots) {
  const n = spots.length
  const edges = []
  if (n < 2) return edges
  const inTree = new Uint8Array(n)
  const best = new Float64Array(n).fill(Infinity)
  const parent = new Int32Array(n).fill(-1)
  best[0] = 0
  for (let iter = 0; iter < n; iter++) {
    let u = -1
    for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i
    inTree[u] = 1
    if (parent[u] >= 0) edges.push({ a: parent[u], b: u, km: best[u] })
    const du = spots[u].dir
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue
      const km = arcKm(du, spots[v].dir)
      if (km < best[v]) {
        best[v] = km
        parent[v] = u
      }
    }
  }
  return edges.sort((x, y) => x.km - y.km)
}

// Petal positions (CSS px, y up) around a spot: one ring up to 10, then
// rings of growing capacity. The first recording sits at 12 o'clock and the
// rest follow clockwise in the order they were made, like the deck's keys.
export function petalLayout(count, spacing) {
  const n = Math.min(count, MAX_PETALS)
  const rings = []
  if (n <= 10) {
    rings.push({ count: n, radius: Math.max(spacing * 0.66, (spacing * n) / (2 * Math.PI)) })
  } else {
    let left = n
    let radius = spacing * 0.95
    while (left > 0) {
      const capacity = Math.max(1, Math.floor((2 * Math.PI * radius) / spacing))
      const take = Math.min(capacity, left)
      rings.push({ count: take, radius })
      left -= take
      radius += spacing * 0.92
    }
  }
  const positions = []
  rings.forEach((ring, k) => {
    for (let i = 0; i < ring.count; i++) {
      const theta = (2 * Math.PI * i) / ring.count + (k % 2 ? Math.PI / ring.count : 0)
      positions.push({ x: ring.radius * Math.sin(theta), y: ring.radius * Math.cos(theta) })
    }
  })
  return { radius: rings[rings.length - 1]?.radius || 0, positions }
}

const _sum = new THREE.Vector3()

export class Grouping {
  constructor() {
    this.spots = []
    this.edges = []
    this.nearest = [] // per spot: { km, edge } of its nearest neighbour
    this.joined = 0 // how many of the shortest tree edges are merged right now
    this.bloomed = new Set() // spot keys drawn as petals
    this.groups = []
    this.version = 0
  }

  setSpots(spots) {
    this.spots = spots
    spots.forEach((spot, i) => { spot.index = i })
    this.edges = spanningTree(spots)
    this.nearest = spots.map(() => ({ km: Infinity, edge: Infinity }))
    this.edges.forEach((edge, index) => {
      for (const i of [edge.a, edge.b]) {
        if (edge.km < this.nearest[i].km) this.nearest[i] = { km: edge.km, edge: index }
      }
    })
    this.joined = Math.min(this.joined, this.edges.length)
    this.dirty = true
  }

  // scale: km per CSS px. opts: { mergePx, bloomMaxScale, bloomNeed(count) → px }
  // Returns true when the grouping changed.
  update(scale, { mergePx, bloomMaxScale, bloomNeed }) {
    const edges = this.edges
    const reach = mergePx * scale
    let k = this.joined
    // 7% either side of the threshold, so a zoom resting on it can't flicker
    while (k < edges.length && edges[k].km < reach * 0.93) k++
    while (k > 0 && edges[k - 1].km > reach * 1.07) k--
    let changed = k !== this.joined || this.dirty
    this.joined = k
    this.dirty = false

    const bloomed = new Set()
    for (const spot of this.spots) {
      if (spot.count < 2) continue
      const was = this.bloomed.has(spot.key)
      const slack = was ? 1.07 : 0.93
      if (scale > bloomMaxScale * slack) continue
      const near = this.nearest[spot.index]
      if (near.edge < k) continue // still merged with a neighbour
      const roomPx = near.km / scale
      if (roomPx * slack < bloomNeed(spot.count)) continue
      bloomed.add(spot.key)
    }
    if (bloomed.size !== this.bloomed.size || [...bloomed].some(key => !this.bloomed.has(key))) changed = true
    this.bloomed = bloomed
    if (!changed) return false

    // Union-find over the merged edges
    const parent = this.spots.map((_, i) => i)
    const find = i => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]]
        i = parent[i]
      }
      return i
    }
    const widest = new Map() // root → longest merged edge inside it
    for (let e = 0; e < k; e++) {
      const ra = find(edges[e].a)
      const rb = find(edges[e].b)
      if (ra !== rb) parent[ra] = rb
    }
    for (let e = 0; e < k; e++) {
      const root = find(edges[e].a)
      widest.set(root, Math.max(widest.get(root) || 0, edges[e].km))
    }
    const byRoot = new Map()
    this.spots.forEach((spot, i) => {
      const root = find(i)
      let group = byRoot.get(root)
      if (!group) {
        group = { spots: [], count: 0, widestKm: widest.get(root) || 0 }
        byRoot.set(root, group)
      }
      group.spots.push(spot)
      group.count += spot.count
    })
    this.groups = [...byRoot.values()]
    for (const group of this.groups) {
      // Heaviest spot leads (its dot stays put while lighter ones peel off)
      group.spots.sort((a, b) => b.count - a.count || b.latest - a.latest)
      group.lead = group.spots[0]
      group.key = group.lead.key
      group.bloom = group.spots.length === 1 && bloomed.has(group.lead.key)
      _sum.set(0, 0, 0)
      for (const spot of group.spots) _sum.addScaledVector(spot.dir, spot.count)
      group.dir = group.spots.length === 1 ? group.lead.dir.clone() : _sum.clone().normalize()
      group.events = group.spots.flatMap(spot => spot.events).sort((a, b) => b.timestamp - a.timestamp)
    }
    this.version++
    return true
  }

  // How far in (km per px) this group needs the camera before it opens up:
  // splits into smaller groups, or blooms if it's one spot.
  openScale(group, { mergePx, bloomMaxScale, bloomNeed }) {
    if (group.spots.length > 1) return group.widestKm / (mergePx * 1.1)
    const spot = group.lead
    if (spot.count < 2) return Infinity
    const near = this.nearest[spot.index]
    const byRoom = Number.isFinite(near.km) ? near.km / (bloomNeed(spot.count) * 1.1) : Infinity
    return Math.min(bloomMaxScale / 1.1, byRoom)
  }

  // The finest scale any single recording at this spot still needs to be
  // drawn on its own (its spot separated, and bloomed if shared).
  focusScale(spot, opts) {
    const near = this.nearest[spot.index]
    let scale = Number.isFinite(near.km) ? near.km / (opts.mergePx * 1.1) : Infinity
    if (spot.count > 1) {
      const room = Number.isFinite(near.km) ? near.km / (opts.bloomNeed(spot.count) * 1.1) : Infinity
      scale = Math.min(scale, room, opts.bloomMaxScale / 1.1)
    }
    return scale
  }

  // Angular extent (km) of a group around its centre: for framing it
  extentKm(group, centre) {
    let widest = 0
    for (const spot of group.spots) widest = Math.max(widest, arcKm(centre, spot.dir))
    return widest
  }

  // Distance (km) from a direction to the nearest spot
  nearestKm(dir) {
    let best = Infinity
    for (const spot of this.spots) best = Math.min(best, arcKm(dir, spot.dir))
    return best
  }

  spotByKey(key) {
    return this.spots.find(spot => spot.key === key) || null
  }
}

// Middle of a group's footprint (not its weighted centroid): what to aim at
// to fit all of it on screen
export function footprintCentre(group) {
  if (group.spots.length === 1) return group.lead.dir.clone()
  let best = null
  let bestReach = Infinity
  // The spot-to-spot midpoint that minimises the farthest spot, good enough
  // for framing (groups are small)
  const candidates = [group.dir]
  for (let i = 0; i < group.spots.length; i++) {
    for (let j = i + 1; j < group.spots.length; j++) {
      candidates.push(group.spots[i].dir.clone().add(group.spots[j].dir).normalize())
    }
    if (candidates.length > 80) break
  }
  for (const candidate of candidates) {
    let reach = 0
    for (const spot of group.spots) reach = Math.max(reach, arcKm(candidate, spot.dir))
    if (reach < bestReach) {
      bestReach = reach
      best = candidate
    }
  }
  return (best || group.dir).clone()
}
