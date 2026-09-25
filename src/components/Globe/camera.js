// One camera move at a time, along the great circle, with an altitude arc on
// long hops. A new flyTo takes over from wherever the camera is and keeps its
// momentum: the new path starts with the camera's current velocity (a cubic
// Hermite ease plus a sideways term that decays), so quick next/next/prev
// presses curve smoothly instead of snapping into reverse. The user's drag
// cancels a move. Every move returns a Promise that resolves on arrival (true)
// or when it's interrupted (false). Time spent paused (recorder open, tab
// hidden) doesn't count: a move asked for while paused starts on the first
// rendered frame, and a move in flight carries on where it stopped.

import * as THREE from 'three'
import {
  RAD_TO_DEG,
  clamp,
  easeInOutCubic,
  easeInOutQuint,
  easeOutCubic,
  toLatLng,
  toVector,
} from './geo.js'

// push: a tap — moves on the tap frame and glides in.
// crane: a lift-and-travel for programmatic hops (next/prev, list, links, posts).
// whip: a quick pan for shuffle.   settle: the long establishing glide.
const STYLES = {
  push: { ease: easeOutCubic, ms: deg => clamp(700 + deg * 9, 760, 1500), bump: deg => (deg > 25 ? Math.min(0.8, (deg - 25) / 55) : 0) },
  crane: { ease: easeInOutCubic, ms: deg => clamp(950 + deg * 10, 1050, 2000), bump: deg => Math.min(1.1, deg / 50) },
  whip: { ease: easeInOutQuint, ms: deg => clamp(720 + deg * 6, 800, 1400), bump: deg => Math.min(0.9, deg / 60) },
  settle: { ease: easeInOutCubic, ms: () => 2600, bump: () => 0 },
}

// Cubic Hermite basis (start value 0, end value 1, end slope 0)
const hermite = (t, m0) => m0 * (t * t * t - 2 * t * t + t) + (3 * t * t - 2 * t * t * t)
const bulge = t => t * t * t - 2 * t * t + t // 0 at both ends, slope 1 at the start

const _p = new THREE.Vector3()
const _v = new THREE.Vector3()
const _t = new THREE.Vector3()

export class CameraRig {
  constructor(globe) {
    this.globe = globe
    this.tween = null
    this.pausedAt = null
    // The last two directions/altitudes we set, for the camera's velocity
    this.trail = { dir: new THREE.Vector3(), alt: 0, time: 0, prevDir: new THREE.Vector3(), prevAlt: 0, prevTime: 0 }
  }

  // delay (ms): hold still this long before moving (counted from the first
  // rendered frame when paused)
  flyTo(target, { ms, style = 'push', reduced = false, delay = 0 } = {}) {
    const g = this.globe
    const from = g.pointOfView()
    const to = {
      lat: target.lat ?? from.lat,
      lng: target.lng ?? from.lng,
      altitude: target.altitude ?? from.altitude,
    }
    const now = performance.now()
    const wasFlying = Boolean(this.tween)
    this.finish(false)
    const a = toVector(from.lat, from.lng, 0, new THREE.Vector3()).normalize()
    const b = toVector(to.lat, to.lng, 0, new THREE.Vector3()).normalize()
    const omega = Math.acos(clamp(a.dot(b), -1, 1))
    const deg = omega * RAD_TO_DEG
    const spec = STYLES[style] || STYLES.push
    // Height moves in log space (a dive from orbit to a town is ×200), and a
    // big change of height takes a little longer
    const zoomSpan = Math.abs(Math.log(Math.max(1e-5, to.altitude) / Math.max(1e-5, from.altitude)))
    const duration = reduced ? 0 : ms ?? spec.ms(deg) + Math.min(800, zoomSpan * 160)
    if (duration <= 0 || (deg < 1e-5 && zoomSpan < 1e-3)) {
      g.pointOfView(to, 0)
      return Promise.resolve(true)
    }
    const tween = {
      a,
      b,
      omega,
      fromAlt: from.altitude,
      toAlt: to.altitude,
      bump: spec.bump(deg),
      ease: spec.ease,
      // Stamped on the first frame that renders it when we're paused now
      start: this.pausedAt == null ? now + delay : null,
      delay,
      duration,
      side: null,
      altSlope: null,
    }
    // Taking over a move in progress: start the new path at the camera's speed
    const trail = this.trail
    const dt = trail.time - trail.prevTime
    if (wasFlying && !delay && this.pausedAt == null && dt > 0 && now - trail.time < 100) {
      _v.copy(trail.dir).sub(trail.prevDir).divideScalar(dt) // rad per ms
      _v.addScaledVector(a, -_v.dot(a)) // tangent to the sphere
      if (omega > 1e-4) {
        _t.copy(b).addScaledVector(a, -a.dot(b)).normalize() // great-circle heading
        const along = _v.dot(_t)
        let m0 = clamp((along * duration) / omega, -2.5, 3)
        if (style === 'push') m0 = Math.max(m0, 1.2) // a tap goes where it was told, now
        tween.ease = t => hermite(t, m0)
        _v.addScaledVector(_t, -along)
      }
      tween.side = _v.clone().multiplyScalar(duration)
      if (tween.side.lengthSq() < 1e-10) tween.side = null
      const logVelocity = Math.log(Math.max(1e-5, trail.alt) / Math.max(1e-5, trail.prevAlt)) / dt
      const logSpan = Math.log(Math.max(1e-5, to.altitude) / Math.max(1e-5, from.altitude))
      if (Math.abs(logSpan) > 1e-3) {
        tween.altSlope = clamp((logVelocity * duration) / logSpan, -3, 3)
      } else {
        tween.altSlope = null
      }
    }
    return new Promise(resolve => {
      tween.resolve = resolve
      this.tween = tween
    })
  }

  // Resolve the current move where it stands (a new move, or the user took over)
  finish(arrived = false) {
    const tween = this.tween
    this.tween = null
    tween?.resolve(arrived)
  }

  cancel() {
    this.finish(false)
  }

  pause(now) {
    if (this.pausedAt == null) this.pausedAt = now
  }

  resume(now) {
    if (this.pausedAt == null) return
    const tween = this.tween
    if (tween && tween.start != null) tween.start += now - this.pausedAt
    this.pausedAt = null
  }

  update(now, controls) {
    const tween = this.tween
    if (!tween) return false
    if (tween.start == null) tween.start = now + tween.delay
    if (now < tween.start) return true
    const t = clamp((now - tween.start) / tween.duration, 0, 1)
    const e = tween.ease(t)
    if (tween.omega > 1e-5) {
      const s = Math.sin(tween.omega)
      _p.copy(tween.a).multiplyScalar(Math.sin((1 - e) * tween.omega) / s)
        .addScaledVector(tween.b, Math.sin(e * tween.omega) / s)
    } else {
      _p.copy(tween.b)
    }
    if (tween.side) _p.addScaledVector(tween.side, bulge(t))
    _p.normalize()
    const altE = tween.altSlope == null ? e : hermite(t, tween.altSlope)
    const logFrom = Math.log(Math.max(1e-5, tween.fromAlt))
    const logTo = Math.log(Math.max(1e-5, tween.toAlt))
    // The lift for long hops, as a factor on the height (relative to the
    // higher end): same peak as before, but a dive from orbit to a town no
    // longer ends in a plunge from a leftover lift
    const lift = 1 + (tween.bump / Math.max(tween.fromAlt, tween.toAlt, 1e-5)) * Math.sin(Math.PI * clamp(e, 0, 1))
    const altitude = Math.exp(logFrom + (logTo - logFrom) * altE) * lift
    const { lat, lng } = toLatLng(_p)
    this.globe.pointOfView({ lat, lng, altitude }, 0)
    const trail = this.trail
    trail.prevDir.copy(trail.dir)
    trail.prevAlt = trail.alt
    trail.prevTime = trail.time
    trail.dir.copy(_p)
    trail.alt = altitude
    trail.time = now
    // Don't let leftover drag inertia push against the move
    controls?._sphericalDelta?.set(0, 0, 0)
    if (t >= 1) this.finish(true)
    return true
  }
}
