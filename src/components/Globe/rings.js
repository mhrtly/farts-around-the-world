// A small pool of flat ring meshes lying on the planet's surface: selection
// pings, "still warm" pulses, pulses on the loud moments of a playing fart,
// arrival bursts and the landing shockwave. Thick and glowing (WebGL lines are
// one device pixel), sized in screen pixels, hidden behind the planet's edge
// by the depth test, and allocated once. A ring can follow a marker that's
// moving (a petal springing out) and hugs the ground closer the lower the
// camera is.

import * as THREE from 'three'
import { FOV, GLOBE_RADIUS, clamp, easeOutCubic, lightBlending, toVector } from './geo.js'

// Height above the ground: 25 km from orbit, ~100 m at town level
const ringAltitude = cameraAltitude => clamp(cameraAltitude * 0.002, 0.000015, 0.004)
const LINE = 0.8 // the ring line sits at 80% of the mesh radius; the rest is glow room
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180)
const _view = new THREE.Vector3()

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uWidth;
  varying vec2 vUv;
  void main() {
    float d = length(vUv * 2.0 - 1.0);
    float x = (d - ${LINE.toFixed(2)}) / uWidth;
    float a = exp(-x * x * 1.6) + 0.32 * exp(-abs(x) / 2.4);
    a *= uAlpha * (1.0 - smoothstep(0.94, 1.0, d));
    gl_FragColor = vec4(uColor * a, 1.0);
  }`

export class RingPool {
  constructor(size = 32) {
    this.group = new THREE.Group()
    this.rings = []
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.geometry = geometry
    const base = lightBlending(new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Vector3(1, 1, 1) },
        uAlpha: { value: 0 },
        uWidth: { value: 0.1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }))
    for (let i = 0; i < size; i++) {
      const material = i === 0 ? base : base.clone()
      const mesh = new THREE.Mesh(geometry, material)
      mesh.visible = false
      mesh.renderOrder = 15
      mesh.frustumCulled = false
      this.group.add(mesh)
      this.rings.push({ mesh, live: false })
    }
  }

  // { lat, lng | at: () → world position (followed each frame), color:
  //   [r,g,b], from, to (px radius), width (px), life (ms), delay (ms),
  //   alpha, ease }
  spawn(now, options) {
    let ring = this.rings.find(candidate => !candidate.live)
    if (!ring) {
      // Recycle the oldest pulse rather than drop a new one
      ring = this.rings.reduce((oldest, candidate) => (candidate.start < oldest.start ? candidate : oldest))
    }
    const { mesh } = ring
    mesh.material.uniforms.uColor.value.set(...options.color)
    Object.assign(ring, {
      lat: options.lat,
      lng: options.lng,
      at: options.at || null,
      live: true,
      start: now + (options.delay || 0),
      life: options.life || 900,
      from: options.from ?? 4,
      to: options.to ?? 30,
      width: options.width ?? 2,
      alpha: options.alpha ?? 0.9,
      ease: options.ease || easeOutCubic,
    })
    mesh.visible = false
    return ring
  }

  update(now, camera, viewportHeight, cameraAltitude = 1) {
    const worldPerPxAt1 = (2 * TAN) / viewportHeight
    const lift = GLOBE_RADIUS * (1 + ringAltitude(cameraAltitude))
    for (const ring of this.rings) {
      if (!ring.live) continue
      const t = (now - ring.start) / ring.life
      if (t < 0) {
        ring.mesh.visible = false
        continue
      }
      if (t >= 1) {
        ring.live = false
        ring.mesh.visible = false
        continue
      }
      const followed = ring.at ? ring.at() : null
      if (followed) ring.mesh.position.copy(followed).normalize().multiplyScalar(lift)
      else toVector(ring.lat, ring.lng, 0, ring.mesh.position).normalize().multiplyScalar(lift)
      ring.mesh.lookAt(0, 0, 0)
      const radiusPx = Math.max(ring.width * 1.5, ring.from + (ring.to - ring.from) * ring.ease(t))
      _view.copy(ring.mesh.position).applyMatrix4(camera.matrixWorldInverse)
      const depth = Math.max(1, -_view.z)
      const meshRadius = (radiusPx / LINE) * depth * worldPerPxAt1
      ring.mesh.scale.setScalar(meshRadius)
      const uniforms = ring.mesh.material.uniforms
      uniforms.uWidth.value = clamp((ring.width / radiusPx) * LINE * 0.76, 0.01, 0.5)
      uniforms.uAlpha.value = ring.alpha * (1 - t) ** 1.3 * Math.min(1, t * 12)
      ring.mesh.visible = true
    }
  }

  dispose() {
    this.geometry.dispose()
    for (const ring of this.rings) ring.mesh.material.dispose()
  }
}
