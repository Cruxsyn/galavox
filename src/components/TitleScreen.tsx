// src/TitleScreen.tsx
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEffect } from 'react'

function Starfield({ count = 2000 }) {
  const geom = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 200
    positions[i * 3 + 0] = (Math.random() - 0.5) * r
    positions[i * 3 + 1] = (Math.random() - 0.5) * r
    positions[i * 3 + 2] = (Math.random() - 0.5) * r
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({ size: 0.8, color: 0xffffff })
  const points = new THREE.Points(geom, mat)

  useFrame((_, dt) => {
    points.rotation.y += dt * 0.02
    points.rotation.x += dt * 0.005
  })

  // return raw primitive so we don't re-create geometry/material too often
  return <primitive object={points} />
}

type Props = {
  onStart: () => void
  onSettings: () => void
  onCredits: () => void
}

export default function TitleScreen({ onStart, onSettings, onCredits }: Props) {
  // allow Enter key to start
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onStart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStart])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* background canvas */}
      <Canvas camera={{ position: [0, 0, 60], fov: 60 }}>
        <color attach="background" args={['#060614']} />
        <Starfield />
      </Canvas>

      {/* UI overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none', // allows canvas to still get events if needed
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            textAlign: 'center',
            color: 'white',
            fontFamily: 'system-ui, Segoe UI, Roboto, sans-serif',
            padding: '24px',
            backdropFilter: 'blur(6px)',
            background: 'rgba(0,0,0,0.25)',
            borderRadius: 16,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            maxWidth: 720,
          }}
        >
          <h1 style={{ fontSize: 64, margin: 0, letterSpacing: 2 }}>
            SPACE FIGHTER
          </h1>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            “press enter to start” — or click the big obvious button, hotshot.
          </p>

          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onStart}
              style={{
                padding: '12px 20px',
                fontSize: 18,
                borderRadius: 12,
                border: '1px solid #6cf',
                background: 'linear-gradient(180deg,#0b2e4a,#091b2b)',
                color: '#aee2ff',
                cursor: 'pointer',
              }}
            >
              Start Game
            </button>
            <button
              onClick={onSettings}
              style={{
                padding: '12px 20px',
                fontSize: 18,
                borderRadius: 12,
                border: '1px solid #888',
                background: 'linear-gradient(180deg,#222,#111)',
                color: '#e0e0e0',
                cursor: 'pointer',
              }}
            >
              Settings
            </button>
            <button
              onClick={onCredits}
              style={{
                padding: '12px 20px',
                fontSize: 18,
                borderRadius: 12,
                border: '1px solid #888',
                background: 'linear-gradient(180deg,#222,#111)',
                color: '#e0e0e0',
                cursor: 'pointer',
              }}
            >
              Credits
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
