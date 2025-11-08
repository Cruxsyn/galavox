import { useRef, useEffect, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useGameServerStore } from './stores/gameServerStore'
import type { Position } from './types/gameState'
import boosterSound from './assets/BOOSTERS NO TRANSIENT.mp3'
import laserShoot from './assets/laserShoot.wav'

// --- TSL imports for the morphing flame ---
import {
  float, vec3, add, sub, mul, mix, clamp, abs, length as lengthNode,
  sin, cos, smoothstep, positionLocal, time
} from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'

interface CharacterProps {
  initialPosition?: Position
}

interface Bullet {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
}

// === Laser Bullet Component ===
function LaserBullet({ bullet }: { bullet: Bullet }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const mat = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    m.color = new THREE.Color('#ff3030')
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.toneMapped = false
    return m
  }, [])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(bullet.position)
    }
  })

  return (
    <mesh ref={meshRef} material={mat} renderOrder={3}>
      <sphereGeometry args={[0.5, 2, 2]} />
    </mesh>
  )
}

// === Morphing flame cube (TSL, no textures) ===
function FlameMorphCubeTSL({
  throttle = 1,
  offset = [0, 0, 3.5] as [number, number, number], // +Z = behind, since forward is -Z in movement
  length = 4.0,
  width = 1.4,
}) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const mat = useMemo(() => {
    const p = positionLocal
    const y01 = add(p.y, float(0.5))

    const ang = add(mul(y01, float(9.0)), mul(time, float(4.0)))
    const s = sin(ang)
    const c = cos(ang)

    const xr = add(mul(p.x, c), mul(p.z, sub(float(0.0), s)))
    const zr = add(mul(p.x, s), mul(p.z, c))

    const taper = mix(float(1.0), float(0.12), clamp(y01, float(0.0), float(1.0)))

    const t = time
    const wobX = mul(sin(add(mul(xr, float(18.0)), mul(t, float(7.0)))), float(0.03))
    const wobZ = mul(sin(add(mul(zr, float(22.0)), mul(t, float(6.0)))), float(0.03))

    const x2 = add(mul(xr, taper), wobX)
    const z2 = add(mul(zr, taper), wobZ)

    const yStretch = add(float(1.0), mul(sin(mul(t, float(8.0))), float(0.07)))
    const y2 = mul(p.y, yStretch)

    const posDeformed = vec3(x2, y2, z2)

    const r = lengthNode(vec3(x2, float(0.0), z2))
    const grad = clamp(y01, float(0.0), float(1.0))

    const flicker = add(
      float(0.85),
      mul(add(abs(sin(mul(t, float(17.0)))), abs(sin(add(mul(t, float(31.0)), float(1.7))))), float(0.15))
    )

    const hot = vec3(1.0, 0.95, 0.75)
    const warm = vec3(1.0, 0.55, 0.12)
    const baseColor = mix(hot, warm, grad)
    const intensity = mul(flicker, float(1.6))
    const colorNode = mul(baseColor, intensity)

    const coreFalloff = sub(float(1.0), smoothstep(float(0.0), float(0.28), r))
    const tipFade = sub(float(1.0), smoothstep(float(0.55), float(1.0), grad))
    const opacityNode = clamp(mul(coreFalloff, tipFade), float(0.0), float(1.0))

    const material = new MeshBasicNodeMaterial()
    // @ts-ignore
    material.positionNode = posDeformed
    // @ts-ignore
    material.colorNode = colorNode
    // @ts-ignore
    material.opacityNode = opacityNode
    material.transparent = true
    material.blending = THREE.AdditiveBlending
    material.depthWrite = false
    material.depthTest = false
    material.toneMapped = true

    return material
  }, [])

  useFrame((state) => {
    const el = state.clock.getElapsedTime()
    const flick = 0.92 + 0.08 * Math.sin(el * 6.0)
    const sY = Math.max(0.05, throttle) * length * flick
    const sX = Math.max(0.25, throttle) * width
    if (meshRef.current) {
      meshRef.current.position.set(...offset)
      meshRef.current.scale.set(sX, sY, sX)
      meshRef.current.rotation.x = Math.PI / 2
    }
  })

  return (
    <mesh ref={meshRef} material={mat} frustumCulled={false} renderOrder={2}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  )
}

export default function Character({ initialPosition }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const { camera } = useThree()
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({})
  const sendPosition = useGameServerStore((state) => state.sendPosition)
  const lastSentTime = useRef(0)
  const lastSentPosition = useRef({
    x: initialPosition?.x ?? 0,
    y: initialPosition?.y ?? 0,
    z: initialPosition?.z ?? 0,
  })
  const hasInitialized = useRef(false)

  // Quaternion-based rotation system
  const rotationSensitivity = 0.002
  const rotationMatrix = useRef(new THREE.Matrix4())
  const mouseDelta = useRef({ x: 0, y: 0 })

  // Audio reference for booster sound
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Bullet management
  const [bullets, setBullets] = useState<Bullet[]>([])
  const nextBulletId = useRef(0)
  const bulletsRef = useRef<Bullet[]>([])
  useEffect(() => { bulletsRef.current = bullets }, [bullets])
  const laserAudioRef = useRef<HTMLAudioElement | null>(null)

  // Load the spaceship model from src/assets folder
  const { scene: spaceshipScene } = useGLTF('/src/assets/spaceship.glb')

  // Initialize rotation matrix
  useEffect(() => {
    if (groupRef.current) {
      rotationMatrix.current.makeRotationFromQuaternion(groupRef.current.quaternion)
    }
  }, [])

  // Initialize audio
  useEffect(() => {
    const audio = new Audio(boosterSound)
    audio.loop = true
    audio.volume = 0.5
    audioRef.current = audio

    const laserAudio = new Audio(laserShoot)
    laserAudio.preload = 'auto'
    laserAudio.volume = 0.7
    laserAudioRef.current = laserAudio

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      laserAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: true }))
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: false }))
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return

      // Accumulate mouse deltas (will be applied in useFrame)
      mouseDelta.current.x += e.movementX
      mouseDelta.current.y += e.movementY
    }

    const handleClick = () => {
      if (!document.pointerLockElement) {
        document.body.requestPointerLock()
      }
    }

    const shoot = () => {
      if (!document.pointerLockElement || !groupRef.current) return

      const leftWingOffset = new THREE.Vector3(-11.5, 0, -2)
      const rightWingOffset = new THREE.Vector3(11.5, 0, -2)

      leftWingOffset.applyQuaternion(groupRef.current.quaternion)
      rightWingOffset.applyQuaternion(groupRef.current.quaternion)

      const leftPos = groupRef.current.position.clone().add(leftWingOffset)
      const rightPos = groupRef.current.position.clone().add(rightWingOffset)

      const bulletSpeed = 200
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(groupRef.current.quaternion).multiplyScalar(bulletSpeed)

      const b1: Bullet = { id: nextBulletId.current++, position: leftPos, velocity: direction.clone() }
      const b2: Bullet = { id: nextBulletId.current++, position: rightPos, velocity: direction.clone() }
      bulletsRef.current = [...bulletsRef.current, b1, b2]
      setBullets(prev => [...prev, b1, b2])

      if (laserAudioRef.current) {
        const node = laserAudioRef.current.cloneNode(true) as HTMLAudioElement
        node.volume = laserAudioRef.current.volume
        void node.play().catch(() => {})
      }
    }

    const handleRightClick = (e: MouseEvent) => {
      e.preventDefault()
      shoot()
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 0) shoot()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('contextmenu', handleRightClick)
    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    document.body.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('contextmenu', handleRightClick)
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true } as any)
      document.body.removeEventListener('click', handleClick)
    }
  }, [])

  const speed = 50
  const [throttle, setThrottle] = useState(0.0)

  // Handle booster audio based on W key state
  useEffect(() => {
    if (!audioRef.current) return
    if (keys['w']) {
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [keys])

  // Update rotation using quaternion-based incremental rotation
  const updateRotation = (delta: { x: number, y: number }) => {
    if (!groupRef.current) return

    // Create incremental rotation quaternions
    const deltaYaw = new THREE.Quaternion()
    const deltaPitch = new THREE.Quaternion()

    // Apply pitch around local X-axis (ship's right vector)
    deltaPitch.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -delta.y * rotationSensitivity)

    // Apply yaw around local Y-axis (ship's up vector)
    deltaYaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), delta.x * rotationSensitivity)

    // Apply rotations in local coordinate system
    // This ensures consistent flight control behavior regardless of ship orientation
    groupRef.current.quaternion.multiply(deltaPitch)   // Pitch around local X-axis
    groupRef.current.quaternion.multiply(deltaYaw)     // Yaw around local Y-axis

    // Normalize quaternion to prevent drift
    groupRef.current.quaternion.normalize()

    // Update rotation matrix for transformations
    rotationMatrix.current.makeRotationFromQuaternion(groupRef.current.quaternion)
  }

  useFrame((_state, delta) => {
    if (!groupRef.current) return

    // Set initial position once
    if (!hasInitialized.current && initialPosition) {
      groupRef.current.position.set(initialPosition.x, initialPosition.y, initialPosition.z)
      hasInitialized.current = true
    }

    // Apply accumulated mouse deltas to rotation
    if (mouseDelta.current.x !== 0 || mouseDelta.current.y !== 0) {
      updateRotation(mouseDelta.current)
      // Reset deltas after applying
      mouseDelta.current.x = 0
      mouseDelta.current.y = 0
    }

    // --- Movement (unchanged) ---
    const moveSpeed = speed * delta
    const isMovingForward = keys['w']
    const isMoving = keys['w'] || keys['s']

    // Move the spaceship in the direction it's facing
    if (isMovingForward || keys['s']) {
      const direction = new THREE.Vector3(0, 0, -1) // Forward is -Z
      direction.applyQuaternion(groupRef.current.quaternion) // Apply ship's rotation
      const speedMultiplier = isMovingForward ? 1 : -0.5
      groupRef.current.position.addScaledVector(direction, moveSpeed * speedMultiplier)
    }

    // Smooth throttle between idle and full
    const targetThrottle = isMovingForward ? 1.0 : 0.2
    const throttleLerp = 1 - Math.pow(0.0001, delta)
    setThrottle((prev) => prev + (targetThrottle - prev) * throttleLerp)

    // Send position to server only when moving (every 100ms)
    if (isMoving) {
      const now = Date.now()
      const currentPos = groupRef.current.position
      const threshold = 0.01
      const dx = currentPos.x - lastSentPosition.current.x
      const dy = currentPos.y - lastSentPosition.current.y
      const dz = currentPos.z - lastSentPosition.current.z
      const distanceMoved = Math.sqrt(dx*dx + dy*dy + dz*dz)

      if (distanceMoved > threshold && now - lastSentTime.current > 100) {
        sendPosition(currentPos.x, currentPos.y, currentPos.z)
        lastSentPosition.current = { x: currentPos.x, y: currentPos.y, z: currentPos.z }
        lastSentTime.current = now
      }
    }

    // Camera follow (behind and above), honoring rotation
    const cameraOffset = new THREE.Vector3(0, 30, 80)
    cameraOffset.applyQuaternion(groupRef.current.quaternion)
    const targetCameraPosition = new THREE.Vector3().copy(groupRef.current.position).add(cameraOffset)
    camera.position.lerp(targetCameraPosition, 0.1)
    camera.lookAt(groupRef.current.position)
  })

  return (
    <group
      ref={groupRef}
      position={[
        initialPosition?.x ?? 0,
        initialPosition?.y ?? 0,
        initialPosition?.z ?? 0,
      ]}
    >
      <ambientLight intensity={1} />

      <primitive object={spaceshipScene.clone()} scale={1} />

      {/* Morphing exhaust flame (no textures, pure TSL) */}
      <FlameMorphCubeTSL
        throttle={throttle}
        offset={[0, -1.3, 3.5]}
        length={5.0}
        width={3.4}
      />

      {/* bullets */}
      {bullets.map((b) => (
        <LaserBullet key={b.id} bullet={b} />
      ))}
    </group>
  )
}
