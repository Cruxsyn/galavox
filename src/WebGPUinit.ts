import { WebGPURenderer } from 'three/webgpu'
import { Color, SRGBColorSpace } from 'three'

export const createWebGPURenderer = async (defaultProps: any) => {
  const renderer = new WebGPURenderer({ 
    canvas: defaultProps.canvas, 
    antialias: true 
  })
  renderer.setClearColor(new Color(0x000000))
  renderer.outputColorSpace = SRGBColorSpace
  
  const canvas = defaultProps.canvas
  
  // Get canvas dimensions from its actual size in the DOM
  // Use offsetWidth/offsetHeight which includes padding/border, or clientWidth/clientHeight
  // Fallback to a reasonable default if canvas isn't sized yet
  const getCanvasSize = () => {
    const rect = canvas.getBoundingClientRect()
    return {
      width: rect.width || canvas.clientWidth || canvas.offsetWidth || 800,
      height: rect.height || canvas.clientHeight || canvas.offsetHeight || 600
    }
  }
  
  const { width, height } = getCanvasSize()
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Cap pixel ratio for performance
  
  await renderer.init()
  
  // Add resize handler to update renderer when window/canvas resizes
  const handleResize = () => {
    const { width: newWidth, height: newHeight } = getCanvasSize()
    if (newWidth > 0 && newHeight > 0) {
      renderer.setSize(newWidth, newHeight)
    }
  }
  
  window.addEventListener('resize', handleResize)
  
  // Store cleanup function on renderer for potential cleanup
  ;(renderer as any).__resizeCleanup = () => {
    window.removeEventListener('resize', handleResize)
  }
  
  // Force an initial render after initialization
  if (defaultProps.gl) {
    renderer.render(defaultProps.scene, defaultProps.camera)
  }
  
  return renderer
}
