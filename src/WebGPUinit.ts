import { WebGPURenderer } from 'three/webgpu'
import { Color, SRGBColorSpace } from 'three'

export const createWebGPURenderer = async (defaultProps: any) => {
  const renderer = new WebGPURenderer({ 
    canvas: defaultProps.canvas, 
    antialias: true 
  })
  renderer.setClearColor(new Color(0x000000))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setSize(window.innerWidth, window.innerHeight)
  
  await renderer.init()
  
  return renderer
}
