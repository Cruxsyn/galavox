declare module 'three/examples/jsm/capabilities/WebGPU.js' {
  const WebGPU: {
    isAvailable: () => boolean;
  };
  export default WebGPU;
}

declare module 'three/src/renderers/webgpu/WebGPURenderer.js' {
  import type { Color } from 'three';
  
  export interface WebGPURendererParameters {
    canvas?: HTMLCanvasElement;
    antialias?: boolean;
    [key: string]: any;
  }

  export default class WebGPURenderer {
    constructor(parameters?: WebGPURendererParameters);
    setClearColor(color: Color | number | string, alpha?: number): void;
    setSize(width: number, height: number): void;
    render(scene: any, camera: any): void;
    [key: string]: any;
  }
}

