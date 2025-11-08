// src/GameRoot.tsx
import { useState, useCallback } from 'react'
import TitleScreen from './TitleScreen'


type GameState = 'menu' | 'playing' | 'settings' | 'credits'

export default function GameRoot() {
  const [state, setState] = useState<GameState>('menu')

  const start = useCallback(() => setState('playing'), [])
  const settings = useCallback(() => setState('settings'), [])
  const credits = useCallback(() => setState('credits'), [])
  const back = useCallback(() => setState('menu'), [])

  if (state === 'menu') {
    return <TitleScreen onStart={start} onSettings={settings} onCredits={credits} />
  }

  if (state === 'settings') {
    return (
      <div style={{ color: 'white', height: '100vh', background: '#0a0a12', padding: 24 }}>
        <h2>Settings</h2>
        <p>(toggles go here — audio, sensitivity, invert Y like a monster, etc.)</p>
        <button onClick={back}>Back</button>
      </div>
    )
  }

  if (state === 'credits') {
    return (
      <div style={{ color: 'white', height: '100vh', background: '#0a0a12', padding: 24 }}>
        <h2>Credits</h2>
        <p>Code: Kaden the Destroyer</p>
        <p>Attitude: Passive-aggressive robot</p>
        <button onClick={back}>Back</button>
      </div>
    )
  }

  // playing
  return <GameWorld onExit={back} />
}
