import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const stub = (name: string) => fileURLToPath(new URL(`./src/vendor-stubs/${name}`, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // three-globe imports three's WebGPU renderer, TSL and h3-js for layers this
    // app never uses (GPU heatmaps, hex bins, WebGPU mode). Stubbing them keeps
    // ~190 KB (gzipped) of dead code out of the first load.
    alias: [
      { find: /^three\/webgpu$/, replacement: stub('three-webgpu.js') },
      { find: /^three\/tsl$/, replacement: stub('three-tsl.js') },
      { find: /^h3-js$/, replacement: stub('h3-js.js') },
    ],
  },
  optimizeDeps: {
    include: ['three', 'three-globe', 'globe.gl'],
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries change rarely: separate chunks stay cached across deploys.
        manualChunks(id) {
          if (/node_modules\/(three|three-globe|globe\.gl|three-render-objects|three-slippy-map-globe|three-conic-polygon-geometry|three-geojson-geometry|kapsule|d3-[a-z-]+|tinycolor2|accessor-fn|index-array-by|data-bind-mapper|frame-ticker|float-tooltip|polished|@tweenjs)\//.test(id)) return 'globe'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
