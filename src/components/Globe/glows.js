// Free-floating points of light, one draw call: puffs that drift up from a
// place, the landing comet and its trail, and impact flashes. Each item
// describes itself with a small function of time; the pool writes attributes.

import * as THREE from 'three'
import { FOV, GLOBE_RADIUS, lightBlending } from './geo.js'

const TAN = Math.tan(((FOV / 2) * Math.PI) / 180)
const _view = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _n = new THREE.Vector3()

const vertexShader = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute vec2 aLight;   // x: alpha, y: hot core amount
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying vec2 vLight;
  void main() {
    vColor = aColor;
    vLight = aLight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aLight.x > 0.001 ? aSize * uPixelRatio : 0.0;
  }`

const fragmentShader = `
  varying vec3 vColor;
  varying vec2 vLight;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = exp(-d * d * 4.2);
    float hot = exp(-d * d * 30.0) * vLight.y;
    float a = (soft * 0.7 + hot) * (1.0 - smoothstep(0.8, 1.0, d)) * vLight.x;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), clamp(hot, 0.0, 1.0) * 0.8) * a, 1.0);
  }`

export class GlowPool {
  constructor(size, pixelRatio) {
    this.size = size
    this.items = []
    this.positions = new Float32Array(size * 3)
    this.sizes = new Float32Array(size)
    this.colors = new Float32Array(size * 3)
    this.lights = new Float32Array(size * 2)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('aLight', new THREE.BufferAttribute(this.lights, 2).setUsage(THREE.DynamicDrawUsage))
    geometry.setDrawRange(0, 0)
    this.geometry = geometry
    this.material = lightBlending(new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: pixelRatio } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }))
    this.points = new THREE.Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 25
  }

  // item: { start, life, color: [r,g,b], at(t, outVector3) → position,
  //         size(t, pxPerWorld) → px, alpha(t) → 0..1, hot(t) → 0..1 }
  add(item) {
    if (this.items.length >= this.size) this.items.shift()
    this.items.push(item)
  }

  update(now, camera, viewportHeight) {
    if (!this.items.length && this.geometry.drawRange.count === 0) return
    _cam.copy(camera.position)
    const camDist = _cam.length()
    this.items = this.items.filter(item => now < item.start + item.life)
    let n = 0
    for (const item of this.items) {
      const t = (now - item.start) / item.life
      if (t < 0) continue
      const pos = item.at(t, _n)
      _view.copy(pos).applyMatrix4(camera.matrixWorldInverse)
      const pxPerWorld = viewportHeight / (2 * TAN * Math.max(1, -_view.z))
      // Hidden once it's behind the planet (these skip the depth test). A raised
      // point stays visible past the surface horizon by acos(R / r).
      const r = pos.length()
      const angle = Math.acos(Math.max(-1, Math.min(1, pos.dot(_cam) / (r * camDist))))
      const limit = Math.acos(Math.min(1, GLOBE_RADIUS / camDist)) + Math.acos(Math.min(1, GLOBE_RADIUS / r))
      const facing = Math.min(1, Math.max(0, (limit - angle) / 0.03))
      this.positions[n * 3] = pos.x
      this.positions[n * 3 + 1] = pos.y
      this.positions[n * 3 + 2] = pos.z
      this.sizes[n] = item.size(t, pxPerWorld)
      this.colors[n * 3] = item.color[0]
      this.colors[n * 3 + 1] = item.color[1]
      this.colors[n * 3 + 2] = item.color[2]
      this.lights[n * 2] = item.alpha(t) * facing
      this.lights[n * 2 + 1] = item.hot ? item.hot(t) : 0
      n++
    }
    this.geometry.setDrawRange(0, n)
    for (const name of ['position', 'aSize', 'aColor', 'aLight']) this.geometry.attributes[name].needsUpdate = true
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
