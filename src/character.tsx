import { useRef, useEffect, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useGameServerContext } from './contexts/GameServerContext'
import type { Position } from './types/gameState'

interface CharacterProps {
  initialPosition?: Position
}

export default function Character({ initialPosition }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const { camera } = useThree()
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})
  const { sendPosition } = useGameServerContext()
  const particlesRef = useRef<THREE.Points>(null!)
  const lastSentTime = useRef(0)
  const lastSentPosition = useRef({ 
    x: initialPosition?.x ?? 0, 
    y: initialPosition?.y ?? 0, 
    z: initialPosition?.z ?? 0 
  })
  const hasInitialized = useRef(false)
  
  // Load the spaceship model
  const { scene } = useGLTF('/src/assets/spaceship.glb')

  // Create particle system for thrust effect
  const particleCount = 50
  const { particleGeometry, particles } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)
    const lifetimes = new Float32Array(particleCount)
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
      lifetimes[i] = Math.random()
    }
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    
    return { 
      particleGeometry: geometry,
      particles: { positions, velocities, lifetimes }
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }))
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }))
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const speed = 50
  
  useFrame((_state, delta) => {
    if (!groupRef.current || !particlesRef.current) return

    // Set initial position once
    if (!hasInitialized.current && initialPosition) {
      groupRef.current.position.set(initialPosition.x, initialPosition.y, initialPosition.z)
      hasInitialized.current = true
    }

    const moveSpeed = speed * delta
    const isMovingForward = keys['w']
    const isMoving = keys['w'] || keys['s']

    // Move the spaceship
    if (isMovingForward) groupRef.current.position.z -= moveSpeed  // Forward
    if (keys['s']) groupRef.current.position.z += moveSpeed  // Backward

    // Update particle system for thrust effect
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
    const particleGeo = particlesRef.current.geometry
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      
      if (isMovingForward) {
        // Update existing particles
        particles.lifetimes[i] += delta * 2
        
        if (particles.lifetimes[i] > 1) {
          // Reset particle at spaceship's back
          positions[i3] = (Math.random() - 0.5) * 2
          positions[i3 + 1] = (Math.random() - 0.5) * 2
          positions[i3 + 2] = 5  // Behind the ship
          particles.velocities[i3 + 2] = 30 + Math.random() * 20
          particles.lifetimes[i] = 0
        } else {
          // Move particle backward (in local space)
          positions[i3 + 2] += particles.velocities[i3 + 2] * delta
        }
      } else {
        // Hide particles when not thrusting
        particles.lifetimes[i] = 1.1
      }
    }
    
    particleGeo.attributes.position.needsUpdate = true

    // Send position to server only when moving (every 100ms)
    if (isMoving) {
      const now = Date.now()
      const currentPos = groupRef.current.position
      
      // Check if position has actually changed
      const threshold = 0.01 // Minimum distance to consider as movement
      const distanceMoved = Math.sqrt(
        Math.pow(currentPos.x - lastSentPosition.current.x, 2) +
        Math.pow(currentPos.y - lastSentPosition.current.y, 2) +
        Math.pow(currentPos.z - lastSentPosition.current.z, 2)
      )
      
      if (distanceMoved > threshold && now - lastSentTime.current > 100) {
        sendPosition(currentPos.x, currentPos.y, currentPos.z)
        lastSentPosition.current = {
          x: currentPos.x,
          y: currentPos.y,
          z: currentPos.z
        }
        lastSentTime.current = now
      }
    }

    // Make camera follow the spaceship (behind and above)
    const targetCameraPosition = new THREE.Vector3(
      groupRef.current.position.x,
      groupRef.current.position.y + 30,  // Height above spaceship
      groupRef.current.position.z + 80   // Distance behind spaceship
    )
    
    // Smooth camera following
    camera.position.lerp(targetCameraPosition, 0.1)
    camera.lookAt(groupRef.current.position)
  })

  return (
    <group 
      ref={groupRef} 
      position={[
        initialPosition?.x ?? 0, 
        initialPosition?.y ?? 0, 
        initialPosition?.z ?? 0
      ]}
    >
      <primitive object={scene.clone()} scale={1} />
      
      {/* Thrust particle effect */}
      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          size={2}
          color="#ff6600"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}