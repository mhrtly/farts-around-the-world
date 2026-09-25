// Small, allocation-free helpers shared by the globe layers: coordinates
// (the same projection three-globe uses), easing curves and a spring.

import * as THREE from 'three'

export const GLOBE_RADIUS = 100
export const FOV = 50 // globe.gl's camera field of view (degrees, vertical)
const RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI
export const TAN_HALF_FOV = Math.tan((FOV / 2) * RAD)

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// three-globe's polar2Cartesian, written into `out`
export function toVector(lat, lng, altitude = 0, out = new THREE.Vector3()) {
  const phi = (90 - lat) * RAD
  const theta = (90 - lng) * RAD
  const r = GLOBE_RADIUS * (1 + altitude)
  const s = Math.sin(phi)
  return out.set(r * s * Math.cos(theta), r * Math.cos(phi), r * s * Math.sin(theta))
}

// three-globe's cartesian2Polar
export function toLatLng(v) {
  const r = v.length() || 1
  const phi = Math.acos(clamp(v.y / r, -1, 1))
  const theta = Math.atan2(v.z, v.x)
  return {
    lat: 90 - phi / RAD,
    lng: 90 - theta / RAD - (theta < -Math.PI / 2 ? 360 : 0),
    altitude: r / GLOBE_RADIUS - 1,
  }
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
// Great-circle distance in degrees
export function arcDegrees(latA, lngA, latB, lngB) {
  toVector(latA, lngA, 0, _a).normalize()
  toVector(latB, lngB, 0, _b).normalize()
  return Math.acos(clamp(_a.dot(_b), -1, 1)) / RAD
}

// Frame-rate independent exponential approach (time constant in ms)
export function damp(current, target, dt, ms) {
  return current + (target - current) * (1 - Math.exp(-dt / ms))
}

export const easeOutCubic = t => 1 - (1 - t) ** 3
export const easeOutQuart = t => 1 - (1 - t) ** 4
export const easeInCubic = t => t * t * t
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const easeInOutQuint = t => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2)

// One step of a damped spring toward 1 (semi-implicit Euler; dt in seconds)
export function stepSpring(state, dt, stiffness, damping) {
  const h = Math.min(dt, 1 / 30)
  state.v += (-stiffness * (state.x - 1) - damping * state.v) * h
  state.x += state.v * h
  return state.x
}

// '#62f6d0' → [r, g, b] in 0..1, in sRGB (our own shaders write sRGB directly,
// so the glow adds up the way the CSS mock's box-shadows do)
export function rgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// Light that adds to whatever is behind it without touching the canvas alpha,
// so glows past the planet's edge add onto the page background instead of
// punching dark squares into it.
export function lightBlending(material) {
  material.blending = THREE.CustomBlending
  material.blendEquation = THREE.AddEquation
  material.blendSrc = THREE.OneFactor
  material.blendDst = THREE.OneFactor
  material.blendSrcAlpha = THREE.ZeroFactor
  material.blendDstAlpha = THREE.OneFactor
  return material
}
