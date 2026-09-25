// The planet as seen through the instrument: teal-graphite land, sodium city
// lights that come on like streetlights, a faint phosphor rim, a 15° graticule
// and a real starfield.

import * as THREE from 'three'
import { isAppleWebKit } from '../../utils/browserEnv.js'
import { GLOBE_RADIUS, lightBlending } from './geo.js'

// ── Coordinate grid for close up ─────────────────────────────────────────
// Lines of latitude and longitude every 1°, 0.1° and 0.01°, drawn in the
// surface shaders so they stay one pixel wide at any zoom. Each level fades
// in once its lines are far enough apart on screen. Recordings are rounded
// to 0.01°, so up close every dot sits on a crossing of the finest grid.
const GRID_GLSL = `
uniform float uGrid;
float fatwGridLevel(vec2 ll, vec2 w, float spacing) {
  vec2 dist = abs(fract(ll / spacing + 0.5) - 0.5) * spacing / max(w, vec2(1e-9));
  float line = 1.0 - smoothstep(0.4, 1.4, min(dist.x, dist.y));
  float gap = spacing / max(max(w.x, w.y), 1e-9);
  return line * smoothstep(28.0, 120.0, gap);
}
float fatwGrid(vec2 ll) {
  vec2 w = fwidth(ll);
  if (w.x > 60.0) w.x = w.y; // across the date line seam
  float g = fatwGridLevel(ll, w, 1.0);
  g = max(g, fatwGridLevel(ll, w, 0.1) * 0.75);
  g = max(g, fatwGridLevel(ll, w, 0.01) * 0.55);
  return g * uGrid;
}
`
const GRID_LIGHT = 'outgoingLight += vec3(0.38, 0.96, 0.82) * fatwGrid(fatwLL) * 0.075;'

// ── Globe material (MeshPhong from three-globe, recoloured in its shader) ──
// The night texture has warm city lights in the red channel and faint land in
// the blue one. Cities become emissive sodium; everything else goes dark teal.
// uWarm (0..1) is the warm-up: each ~2° patch switches on at its own moment,
// striking dim red first like a real sodium lamp, then settling to amber.
export function applyPhosphorLook(material, uniforms) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uWarm = uniforms.uWarm
    shader.uniforms.uGrid = uniforms.uGrid
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uWarm;
${GRID_GLSL}`)
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
  // Far past its resolution (before the close-up tiles arrive) the lights
  // are blobs: pull them back like the tiles do
  fatwCity *= 1.0 - 0.7 * smoothstep(1.5, 7.0, 1.0 / max(max(fatwTexels.x, fatwTexels.y), 1e-4));
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
#ifdef USE_MAP
  vec2 fatwLL = vec2(vMapUv.x * 360.0 - 180.0, vMapUv.y * 180.0 - 90.0);
  ${GRID_LIGHT}
#endif
#include <opaque_fragment>`)
  }
  material.customProgramCacheKey = () => 'fatw-phosphor-4'
  // A dim teal glint instead of three-globe's grey specular haze at the top
  material.specular?.set?.('#0a1613')
  material.shininess = 8
  material.needsUpdate = true
}

// ── Close-up tiles (NASA Black Marble), recoloured the same way ──────────
// Read raw (no colour space). Ocean is ~(4, 5, 15)/255; land is bluish, from
// ~(9, 10, 19) in the east to ~(24, 22, 46) over desert (snow is brighter
// and bluer still); city light is warm, red over blue, burning out to white
// at the core. Land/sea split on green; city light is warmth, or sheer
// brightness that isn't blue. Then the globe's own palette and sodium.
export function applyNightTileLook(material, uniforms) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uGrid = uniforms.uGrid
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aLatLng;
varying vec2 vFatwLL;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vFatwLL = aLatLng;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vFatwLL;
${GRID_GLSL}
// Cubic B-spline filtering from four bilinear taps: up close each tile
// pixel is magnified several times, and plain bilinear shows its grid
vec4 fatwSpline(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) / 6.0;
}
vec4 fatwBicubic(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  vec2 p = uv * size - 0.5;
  vec2 f = fract(p);
  p -= f;
  vec4 xc = fatwSpline(f.x);
  vec4 yc = fatwSpline(f.y);
  vec4 c = p.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 w = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / w) / size.xxyy;
  vec4 s0 = texture2D(tex, o.xz);
  vec4 s1 = texture2D(tex, o.yz);
  vec4 s2 = texture2D(tex, o.xw);
  vec4 s3 = texture2D(tex, o.yw);
  float sx = w.x / (w.x + w.y);
  float sy = w.z / (w.z + w.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}`)
      .replace('#include <map_fragment>', `
float fatwCity = 0.0;
#ifdef USE_MAP
  diffuseColor *= fatwBicubic(map, vMapUv);
  vec3 fatwSrc = diffuseColor.rgb;
  float fatwLand = smoothstep(0.024, 0.036, fatwSrc.g);
  float fatwBright = smoothstep(0.13, 0.22, fatwSrc.b) * fatwLand;
  vec3 fatwBase = mix(vec3(0.0022, 0.0060, 0.0068), vec3(0.012, 0.030, 0.031), fatwLand);
  fatwBase = mix(fatwBase, vec3(0.024, 0.050, 0.050), fatwBright * 0.6);
  // Graded, not thresholded: suburbs glow less than downtowns, and the
  // dark between towns stays dark
  float fatwWarmth = smoothstep(-0.12, 0.02, fatwSrc.r - fatwSrc.b);
  fatwCity = pow(smoothstep(0.07, 1.0, max(fatwSrc.r, fatwSrc.g)) * fatwWarmth, 1.9);
  // Magnified far past the data (500 m a pixel) lights are soft blobs:
  // pull them back so the markers and the grid are the sharp things
  vec2 fatwTexels = fwidth(vMapUv) * 256.0;
  float fatwMag = 1.0 / max(max(fatwTexels.x, fatwTexels.y), 1e-4);
  fatwCity *= 1.0 - 0.62 * smoothstep(2.5, 11.0, fatwMag);
  diffuseColor.rgb = fatwBase * (1.0 - fatwCity * 0.6);
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.43, 0.1) * fatwCity * 0.95;`)
      .replace('#include <opaque_fragment>', `float fatwFacing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
outgoingLight += vec3(0.12, 0.92, 0.63) * pow(1.0 - fatwFacing, 4.0) * 0.048;
vec2 fatwLL = vFatwLL;
${GRID_LIGHT}
#include <opaque_fragment>`)
  }
  material.customProgramCacheKey = () => 'fatw-night-tile-6'
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
