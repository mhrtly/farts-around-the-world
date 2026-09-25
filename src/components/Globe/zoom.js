// Zoom, the way a map zooms: toward the cursor, or between the fingers.
//
// Everything that changes the camera's height goes through here: the mouse
// wheel and trackpad (scroll or pinch), touch pinch (which also pans: the
// ground between the fingers stays between the fingers), double tap and
// two-finger tap (via zoomAt), and the zoom keys. Height changes are
// multiplicative, so every notch is the same step over a continent or over
// a town, and they're anchored: the ground point under the anchor pixel
// stays under it. OrbitControls keeps the one-finger / mouse drag (its own
// dolly is switched off).

import * as THREE from 'three'
import { MAX_ALTITUDE, MIN_ALTITUDE, clamp, surfacePoint, toLatLng } from './geo.js'

const _hit = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _quat = new THREE.Quaternion()

export class ZoomController {
  // size: the live { w, h } of the canvas; onUserZoom: called when the user
  // starts zooming (cancel flights, stop auto-rotate)
  constructor({ globe, camera, mount, size, onUserZoom, onChange }) {
    this.globe = globe
    this.camera = camera
    this.mount = mount
    this.size = size
    this.onUserZoom = onUserZoom
    this.onChange = onChange
    this.anim = null // { target, anchor, tau }
    this.touches = new Map()
    this.pinch = null
    this.reduced = false
    this.enabled = true

    this.handleWheel = this.handleWheel.bind(this)
    this.handleDown = this.handleDown.bind(this)
    this.handleMove = this.handleMove.bind(this)
    this.handleUp = this.handleUp.bind(this)
    const capture = { capture: true, passive: true }
    mount.addEventListener('wheel', this.handleWheel, { capture: true, passive: false })
    mount.addEventListener('pointerdown', this.handleDown, capture)
    mount.addEventListener('pointermove', this.handleMove, capture)
    mount.addEventListener('pointerup', this.handleUp, capture)
    mount.addEventListener('pointercancel', this.handleUp, capture)
  }

  altitude() {
    return this.globe.pointOfView().altitude
  }

  // Where the zoom is heading (the current height when it's not moving)
  targetAltitude() {
    return this.anim ? this.anim.target : this.altitude()
  }

  // Canvas px → the ground under it, as a unit vector (null off the planet)
  groundAt(x, y) {
    this.camera.updateMatrixWorld()
    const hit = surfacePoint(this.camera, x, y, this.size.w, this.size.h, _hit)
    return hit ? hit.clone().normalize() : null
  }

  // Put the camera at `altitude` (same direction), then turn it so the
  // anchor's ground point is back under the anchor pixel. The camera stays
  // north-up (lookAt), so it's refined a few times.
  apply(altitude, anchor) {
    const alt = clamp(altitude, MIN_ALTITUDE, MAX_ALTITUDE)
    _dir.copy(this.camera.position).normalize()
    this.place(_dir, alt)
    if (anchor?.point) {
      for (let i = 0; i < 3; i++) {
        const under = this.groundAt(anchor.x, anchor.y)
        if (!under) break
        if (under.dot(anchor.point) > 1 - 1e-15) break
        _quat.setFromUnitVectors(under, anchor.point)
        _dir.copy(this.camera.position).normalize().applyQuaternion(_quat)
        this.place(_dir, alt)
      }
    }
    this.onChange?.()
    return alt
  }

  place(dir, altitude) {
    const { lat, lng } = toLatLng(dir)
    this.globe.pointOfView({ lat: clamp(lat, -89.9, 89.9), lng, altitude }, 0)
    // pointOfView only moves the camera (OrbitControls re-aims it on its next
    // update): aim it now, the way the controls will, so the refinement
    // passes see the view that's actually going to be drawn
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
  }

  // Animated zoom to `altitude` around a canvas point (null: the middle of
  // the globe on screen, i.e. straight down)
  zoomTo(altitude, at = null, { tau = 110 } = {}) {
    const target = clamp(altitude, MIN_ALTITUDE, MAX_ALTITUDE)
    let anchor = null
    if (at) {
      const previous = this.anim?.anchor
      // Same spot as the zoom in progress: keep its ground point (re-reading
      // it mid-move would let it creep)
      if (previous && Math.hypot(previous.x - at.x, previous.y - at.y) < 3) anchor = previous
      else {
        const point = at.point || this.groundAt(at.x, at.y)
        if (point) anchor = { x: at.x, y: at.y, point }
      }
    }
    if (this.reduced) {
      this.anim = null
      this.apply(target, anchor)
      return
    }
    this.anim = { target, anchor, tau }
  }

  zoomBy(factor, at = null, options) {
    this.zoomTo(this.targetAltitude() * factor, at, options)
  }

  // A tap-to-zoom (double tap in, two-finger tap out): a smooth ~0.35 s move
  zoomAt(x, y, factor) {
    this.onUserZoom?.()
    this.zoomTo(this.targetAltitude() * factor, { x, y }, { tau: 95 })
  }

  stop() {
    this.anim = null
  }

  // One frame of an animated zoom. Returns true while moving.
  update(dt) {
    const anim = this.anim
    if (!anim || this.pinch) return false
    const current = this.altitude()
    const logCurrent = Math.log(current)
    const logTarget = Math.log(anim.target)
    const k = 1 - Math.exp(-Math.max(1, dt) / anim.tau)
    let next = Math.exp(logCurrent + (logTarget - logCurrent) * k)
    if (Math.abs(logTarget - Math.log(next)) < 0.003) {
      next = anim.target
      this.anim = null
    }
    this.apply(next, anim.anchor)
    return true
  }

  // ── Input ──────────────────────────────────────────────────────────────
  handleWheel(event) {
    if (!this.enabled) return
    event.preventDefault() // page scroll, and the browser's own pinch-zoom
    let dy = event.deltaY
    if (event.deltaMode === 1) dy *= 33
    else if (event.deltaMode === 2) dy *= 400
    if (!dy) return
    // Trackpad pinches arrive as ctrl+wheel with small deltas
    const gain = event.ctrlKey ? 0.011 : 0.0021
    const factor = Math.exp(clamp(dy, -250, 250) * gain)
    const rect = this.mount.getBoundingClientRect()
    this.onUserZoom?.()
    this.zoomTo(this.targetAltitude() * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top }, { tau: event.ctrlKey ? 40 : 80 })
  }

  handleDown(event) {
    if (event.pointerType !== 'touch' || !this.enabled) return
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY })
    if (this.touches.size === 2) this.startPinch()
    else if (this.touches.size > 2) this.pinch = null
  }

  handleMove(event) {
    const touch = this.touches.get(event.pointerId)
    if (!touch) return
    touch.x = event.clientX
    touch.y = event.clientY
    const pinch = this.pinch
    if (!pinch || this.touches.size !== 2) return
    const [a, b] = [...this.touches.values()]
    const dist = Math.max(8, Math.hypot(a.x - b.x, a.y - b.y))
    const rect = this.mount.getBoundingClientRect()
    const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }
    pinch.moved = Math.max(pinch.moved, Math.hypot(a.x - a.x0, a.y - a.y0), Math.hypot(b.x - b.x0, b.y - b.y0))
    if (!pinch.live) {
      // A two-finger tap shouldn't twitch the view: wait for real movement
      if (pinch.moved < 6 && Math.abs(dist - pinch.dist) < 6) return
      pinch.live = true
      this.onUserZoom?.()
    }
    this.apply(pinch.altitude * (pinch.dist / dist), pinch.anchor ? { x: mid.x, y: mid.y, point: pinch.anchor } : null)
  }

  handleUp(event) {
    if (!this.touches.has(event.pointerId)) return
    const pinch = this.pinch
    this.touches.delete(event.pointerId)
    if (pinch && this.touches.size < 2) {
      this.pinch = null
      // Two fingers down and up together without moving: zoom out a step
      if (!pinch.live && performance.now() - pinch.at < 320 && event.type === 'pointerup') {
        this.zoomAt(pinch.mid.x, pinch.mid.y, 2.2)
      }
    }
  }

  startPinch() {
    const [a, b] = [...this.touches.values()]
    const rect = this.mount.getBoundingClientRect()
    const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top }
    this.anim = null
    this.pinch = {
      dist: Math.max(8, Math.hypot(a.x - b.x, a.y - b.y)),
      altitude: this.altitude(),
      anchor: this.groundAt(mid.x, mid.y),
      mid,
      at: performance.now(),
      moved: 0,
      live: false,
    }
  }

  get pinching() {
    return Boolean(this.pinch?.live)
  }

  dispose() {
    const capture = { capture: true }
    this.mount.removeEventListener('wheel', this.handleWheel, capture)
    this.mount.removeEventListener('pointerdown', this.handleDown, capture)
    this.mount.removeEventListener('pointermove', this.handleMove, capture)
    this.mount.removeEventListener('pointerup', this.handleUp, capture)
    this.mount.removeEventListener('pointercancel', this.handleUp, capture)
  }
}
