// three-globe's hex layers use h3-js; this app doesn't use them.
const unused = () => { throw new Error('h3-js is not bundled (hex layers are unused)') }
export const latLngToCell = unused
export const cellToLatLng = unused
export const cellToBoundary = unused
export const polygonToCells = unused
