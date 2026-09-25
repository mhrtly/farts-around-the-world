// Which recordings share a marker at the current zoom.
//
// A spot is every recording at one rounded coordinate (the server rounds to
// ~1 km, so a spot is as precise as the map gets). At each zoom step, spots
// closer than `mergePx` on screen to a busier one share its marker. A spot
// of several recordings "blooms" into a ring of petals, one per fart, once
// there's room for the ring around it.
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

// Zoom steps: the grouping is worked out for scales a factor of √2 apart,
// so it changes in clear steps instead of every frame
const stepOf = scale => -Math.log2(scale) * 2
const scaleOfStep = step => 2 ** (-step / 2)

export class Grouping {
  constructor() {
    this.spots = []
    this.nearest = [] // per spot: km to its nearest neighbour
    this.step = null
    this.cache = new Map() // step → groups (until the data changes)
    this.bloomed = new Set() // spot keys drawn as petals
    this.groups = []
    this.version = 0
  }

  setSpots(spots) {
    const previous = this.spots
    this.spots = spots
    spots.forEach((spot, i) => { spot.index = i })
    // Same spots in the same order (a place name arrived, say): the
    // distances haven't changed
    const same = previous.length === spots.length && spots.every((spot, i) => spot.key === previous[i].key)
    if (!same) {
      // Nearest neighbour of every spot: the largest dot product (cheap),
      // turned into km once per spot
      const best = new Float64Array(spots.length).fill(-2)
      for (let i = 0; i < spots.length; i++) {
        const a = spots[i].dir
        for (let j = i + 1; j < spots.length; j++) {
          const dot = a.dot(spots[j].dir)
          if (dot > best[i]) best[i] = dot
          if (dot > best[j]) best[j] = dot
        }
      }
      this.nearest = [...best].map(dot => (dot < -1.5 ? Infinity : Math.acos(Math.min(1, dot)) * 6371))
    }
    this.cache = new Map()
    this.dirty = true
  }

  // Greedy clustering at one zoom step (the approach map libraries use):
  // the busiest spot not yet taken seeds a group and takes every free spot
  // within the merge radius of it. Groups stay compact (no chaining through a
  // dense city), whatever the density.
  groupsAt(step, mergePx) {
    const cached = this.cache.get(step)
    if (cached) return cached
    const radiusKm = mergePx * scaleOfStep(step)
    const minDot = Math.cos(Math.min(Math.PI, radiusKm / 6371))
    const order = [...this.spots].sort((a, b) => b.count - a.count || b.latest - a.latest)
    const taken = new Uint8Array(this.spots.length)
    const groups = []
    for (const seed of order) {
      if (taken[seed.index]) continue
      taken[seed.index] = 1
      const members = [seed]
      let reach = 0
      for (const other of order) {
        if (taken[other.index]) continue
        const dot = seed.dir.dot(other.dir)
        if (dot < minDot) continue
        taken[other.index] = 1
        members.push(other)
        reach = Math.max(reach, arcKm(seed.dir, other.dir))
      }
      groups.push({ spots: members, reachKm: reach })
    }
    this.cache.set(step, groups)
    return groups
  }

  // scale: km per CSS px. opts: { mergePx, bloomMaxScale, bloomNeed(count) → px }
  // Returns true when the grouping changed.
  update(scale, { mergePx, bloomMaxScale, bloomNeed }) {
    // Hold the current step until the scale is well past its edges
    const exact = stepOf(scale)
    let step = this.step
    if (step == null || exact < step - 0.2 || exact > step + 1.2) step = Math.floor(exact)
    let changed = step !== this.step || this.dirty
    this.step = step
    this.dirty = false
    const base = this.groupsAt(step, mergePx)

    const bloomed = this.spare || new Set()
    bloomed.clear()
    for (const group of base) {
      if (group.spots.length !== 1) continue
      const spot = group.spots[0]
      if (spot.count < 2) continue
      const was = this.bloomed.has(spot.key)
      const slack = was ? 1.07 : 0.93
      if (scale > bloomMaxScale * slack) continue
      const roomPx = this.nearest[spot.index] / scale
      if (roomPx * slack < bloomNeed(spot.count)) continue
      bloomed.add(spot.key)
    }
    if (bloomed.size !== this.bloomed.size) changed = true
    else for (const key of bloomed) if (!this.bloomed.has(key)) { changed = true; break }
    this.spare = this.bloomed
    this.bloomed = bloomed
    if (!changed) return false

    this.groups = base.map(({ spots, reachKm }) => {
      // Heaviest spot leads (its dot stays put while lighter ones peel off)
      const lead = spots[0]
      _sum.set(0, 0, 0)
      for (const spot of spots) _sum.addScaledVector(spot.dir, spot.count)
      return {
        spots,
        lead,
        key: lead.key,
        reachKm,
        count: spots.reduce((sum, spot) => sum + spot.count, 0),
        bloom: spots.length === 1 && bloomed.has(lead.key),
        dir: spots.length === 1 ? lead.dir.clone() : _sum.clone().normalize(),
        events: spots.flatMap(spot => spot.events).sort((a, b) => b.timestamp - a.timestamp),
      }
    })
    this.version++
    return true
  }

  // How far in (km per px) this group needs the camera before it opens up:
  // splits into smaller groups, or blooms if it's one spot.
  openScale(group, { mergePx, bloomMaxScale, bloomNeed }) {
    if (group.spots.length > 1) return group.reachKm / (mergePx * 1.5)
    const spot = group.lead
    if (spot.count < 2) return Infinity
    const near = this.nearest[spot.index]
    const byRoom = Number.isFinite(near) ? near / (bloomNeed(spot.count) * 1.1) : Infinity
    return Math.min(bloomMaxScale / 1.1, byRoom)
  }

  // The finest scale any single recording at this spot still needs to be
  // drawn on its own (its spot separated, and bloomed if shared). extra:
  // recordings about to join it (a post on its way).
  focusScale(spot, opts, extra = 0) {
    const near = this.nearest[spot.index]
    const count = spot.count + extra
    let scale = Number.isFinite(near) ? near / (opts.mergePx * 1.5) : Infinity
    if (count > 1) {
      const room = Number.isFinite(near) ? near / (opts.bloomNeed(count) * 1.1) : Infinity
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
