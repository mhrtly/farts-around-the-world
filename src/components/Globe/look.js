// The planet as seen through the instrument: teal-graphite land, sodium city
// lights that come on like streetlights, a faint phosphor rim, a 15° graticule
// and a real starfield.

import * as THREE from 'three'
import { isAppleWebKit } from '../../utils/browserEnv.js'
import { GLOBE_RADIUS, lightBlending } from './geo.js'

// ── Globe material (MeshPhong from three-globe, recoloured in its shader) ──
// The night texture has warm city lights in the red channel and faint land in
// the blue one. Cities become emissive sodium; everything else goes dark teal.
// uWarm (0..1) is the warm-up: each ~2° patch switches on at its own moment,
// striking dim red first like a real sodium lamp, then settling to amber.
export function applyPhosphorLook(material, uniforms) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uWarm = uniforms.uWarm
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uWarm;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float fatwCity = 0.0;
#ifdef USE_MAP
  vec3 fatwSrc = diffuseColor.rgb;
  // Close up, texels get magnified and hard thresholds turn bilinear ramps
  // into blocky contours; soften the thresholds as magnification grows.
  vec2 fatwTexels = fwidth(vMapUv) * vec2(textureSize(map, 0));
  float fatwSoft = clamp(1.0 - max(fatwTexels.x, fatwTexels.y), 0.0, 0.9) * 0.012;
  float fatwLand = smoothstep(0.022 - fatwSoft * 0.5, 0.05 + fatwSoft, fatwSrc.b);
  float fatwBright = smoothstep(0.07 - fatwSoft, 0.12 + fatwSoft, fatwSrc.b);
  vec3 fatwBase = mix(vec3(0.0022, 0.0060, 0.0068), vec3(0.012, 0.030, 0.031), fatwLand);
  fatwBase = mix(fatwBase, vec3(0.024, 0.050, 0.050), fatwBright);
  fatwCity = smoothstep(0.004, 0.14 + fatwSoft * 3.0, fatwSrc.r);
  diffuseColor.rgb = fatwBase * (1.0 - fatwCity * 0.6);
  vec2 fatwCell = floor(vMapUv * vec2(180.0, 90.0));
  float fatwTurn = fract(sin(dot(fatwCell, vec2(12.9898, 78.233))) * 43758.5453);
  float fatwOn = smoothstep(fatwTurn * 0.82, fatwTurn * 0.82 + 0.16, uWarm);
#else
  diffuseColor.rgb = vec3(0.0022, 0.0060, 0.0068);
  float fatwOn = 0.0;
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += mix(vec3(0.55, 0.09, 0.02), vec3(1.0, 0.43, 0.1), fatwOn) * fatwCity * fatwOn * 0.85;`)
      .replace('#include <opaque_fragment>', `float fatwFacing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
outgoingLight += vec3(0.12, 0.92, 0.63) * pow(1.0 - fatwFacing, 4.0) * (0.018 + 0.03 * uWarm);
#include <opaque_fragment>`)
  }
  material.customProgramCacheKey = () => 'fatw-phosphor-1'
  // A dim teal glint instead of three-globe's grey specular haze at the top
  material.specular?.set?.('#0a1613')
  material.shininess = 8
  material.needsUpdate = true
}

// ── Graticule: one LineSegments every 15°, just above the surface ─────────
export function makeGraticule(step = 15) {
  const radius = GLOBE_RADIUS * 1.0015
  const positions = []
  const push = (lat, lng) => {
    const phi = ((90 - lat) * Math.PI) / 180
    const theta = ((90 - lng) * Math.PI) / 180
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    )
  }
  const res = 3
  for (let lat = -75; lat <= 75; lat += step) {
    for (let lng = -180; lng < 180; lng += res) {
      push(lat, lng)
      push(lat, lng + res)
    }
  }
  for (let lng = -180; lng < 180; lng += step) {
    for (let lat = -84; lat < 84; lat += res) {
      push(lat, lng)
      push(lat + res, lng)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({
    color: '#62f6d0',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const lines = new THREE.LineSegments(geometry, material)
  lines.renderOrder = 2
  return lines
}

// ── Starfield: warm-white points far outside the orbit ──────────────────
// One draw call; rendered first (opaque pass) so the planet covers it.
export function makeStarfield(count, pixelRatio) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    // uniform on a sphere
    const u = Math.random() * 2 - 1
    const a = Math.random() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    v.set(s * Math.cos(a), u, s * Math.sin(a)).multiplyScalar(3000 + Math.random() * 1500)
    positions.set([v.x, v.y, v.z], i * 3)
    const r = Math.random()
    sizes[i] = r < 0.72 ? 1 : r < 0.95 ? 1.5 : 2.2
    const brightness = (r < 0.72 ? 0.3 : r < 0.95 ? 0.48 : 0.72) * (0.5 + Math.random() * 0.5)
    // warm white (#E8E2D4), a few a touch bluer or warmer
    const tint = Math.random()
    const c = tint < 0.1 ? [0.8, 0.88, 1] : tint > 0.93 ? [1, 0.84, 0.66] : [0.91, 0.886, 0.83]
    colors.set([c[0] * brightness, c[1] * brightness, c[2] * brightness], i * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  const material = lightBlending(new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      attribute float aSize;
      attribute vec3 aColor;
      uniform float uPixelRatio;
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vColor = aColor * uOpacity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(vColor * (1.0 - smoothstep(0.55, 1.0, d)), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
    transparent: false,
  }))
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = -10
  return points
}

// ── Sharper texture after the warm-up ─────────────────────────────────────
// Decoded off the main thread where possible; the caller uploads it and swaps
// it in, and frees the old map (three-globe never disposes replaced maps). The
// material stays the same, so the tint shader carries over.
// ImageBitmap decoding (fully off-thread) only where its flipY option is
// reliable — not Apple WebKit (every iOS browser), not old Firefox; there an
// <img> decoded with img.decode() does the job.
function bitmapsWork() {
  if (typeof createImageBitmap !== 'function' || typeof ImageBitmap === 'undefined') return false
  if (isAppleWebKit()) return false
  const firefox = navigator.userAgent.match(/Firefox\/(\d+)/)
  return !firefox || Number(firefox[1]) >= 98
}

export function loadGlobeTexture(url, renderer) {
  return new Promise((resolve, reject) => {
    const finish = texture => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      texture.needsUpdate = true
      resolve(texture)
    }
    const viaImage = () => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.decoding = 'async'
      image.src = url
      const ready = image.decode ? image.decode() : new Promise((ok, fail) => { image.onload = ok; image.onerror = fail })
      ready.then(() => finish(new THREE.Texture(image)), reject)
    }
    if (!bitmapsWork()) {
      viaImage()
      return
    }
    const loader = new THREE.ImageBitmapLoader()
    loader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' })
    loader.load(url, bitmap => {
      const texture = new THREE.Texture(bitmap)
      texture.flipY = false
      finish(texture)
    }, undefined, viaImage)
  })
}
