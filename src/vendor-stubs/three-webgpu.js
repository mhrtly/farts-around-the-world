// three-globe's heatmap layer and three-render-objects' optional WebGPU mode
// import three/webgpu; this app renders with WebGL and uses neither.
class Unused { constructor() { throw new Error('three/webgpu is not bundled') } }
export class WebGPURenderer extends Unused {}
export class StorageInstancedBufferAttribute extends Unused {}
