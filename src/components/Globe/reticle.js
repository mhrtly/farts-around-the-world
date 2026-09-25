// The lock-on reticle: four phosphor corner brackets around the selected
// place, drawn procedurally so the lines stay crisp at any pixel ratio. Two
// slots, so the previous reticle can decay (140 ms) while the new one snaps in
// on a spring (k520 c26: from 1.8× to 1× with a little overshoot).

import * as THREE from 'three'
import { lightBlending, rgb, stepSpring } from './geo.js'
import { MarkerLayer } from './markers.js'

const vertexShader = `
  attribute float aHalf;
  attribute float aAlpha;
  uniform float uPixelRatio;
  varying float vHalf;
  varying float vAlpha;
  varying float vRadius;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vHalf = aHalf;
    vAlpha = aAlpha;
    vRadius = aHalf + 9.0;
    gl_PointSize = aAlpha > 0.001 ? vRadius * 2.0 * uPixelRatio : 0.0;
  }`

const fragmentShader = `
  uniform vec3 uColor;
  varying float vHalf;
  varying float vAlpha;
  varying float vRadius;
  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
  }
  void main() {
    vec2 q = abs((gl_PointCoord - 0.5) * 2.0 * vRadius);
    float h = vHalf;
    float arm = max(5.0, h * 0.47);
    float d = min(segment(q, vec2(h, h), vec2(h - arm, h)), segment(q, vec2(h, h), vec2(h, h - arm)));
    float line = 1.0 - smoothstep(0.35, 1.25, d);
    float glow = exp(-d / 2.6) * 0.42;
    gl_FragColor = vec4(uColor * (line + glow) * vAlpha, 1.0);
  }`

export class Reticle {
  constructor(pixelRatio) {
    this.slots = [0, 1].map(() => ({ key: null, pos: new THREE.Vector3(), alpha: 0, on: false, spring: { x: 1, v: 0 }, since: 0 }))
    this.current = 0
    this.positions = new Float32Array(6)
    this.halves = new Float32Array(2)
    this.alphas = new Float32Array(2)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aHalf', new THREE.BufferAttribute(this.halves, 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage))
    this.geometry = geometry
    this.material = lightBlending(new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: pixelRatio },
        uColor: { value: new THREE.Vector3(...rgb('#62f6d0')) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }))
    this.points = new THREE.Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 30
  }

  // Lock on to a place (null to release). `reduced` skips the spring.
  lock(key, pos, now, reduced) {
    const active = this.slots[this.current]
    if (key && active.key === key && active.on) return
    if (active.on) active.on = false // decays where it is
    if (!key) return
    this.current = 1 - this.current
    const slot = this.slots[this.current]
    slot.key = key
    slot.pos.copy(pos)
    slot.on = true
    slot.since = now
    slot.alpha = 0
    slot.spring.x = reduced ? 1 : 1.8
    slot.spring.v = 0
  }

  // half: box half-size in px for the locked place; level: 0..1 audio level
  update(now, dt, camera, half, level) {
    this.slots.forEach((slot, i) => {
      if (slot.on) {
        stepSpring(slot.spring, dt / 1000, 520, 26)
        slot.alpha = Math.min(1, (now - slot.since) / 80)
      } else {
        slot.alpha = Math.max(0, slot.alpha - dt / 140)
      }
      const facing = slot.alpha > 0 ? Math.max(0, Math.min(1, MarkerLayer.facing(slot.pos, camera))) : 0
      this.positions[i * 3] = slot.pos.x
      this.positions[i * 3 + 1] = slot.pos.y
      this.positions[i * 3 + 2] = slot.pos.z
      this.halves[i] = half * slot.spring.x * (1 + (slot.on ? level : 0) * 0.07)
      this.alphas[i] = slot.alpha * facing
    })
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.aHalf.needsUpdate = true
    this.geometry.attributes.aAlpha.needsUpdate = true
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
