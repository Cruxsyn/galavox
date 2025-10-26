import { Canvas } from "@react-three/fiber";
import { createWebGPURenderer } from './WebGPUinit';
import { GameServerProvider, useGameServerContext } from './contexts/GameServerContext';
import type { Planet } from './types/gameState';
import Character from './character';

function PlanetMesh({ planet }: { planet: Planet }) {
  return (
    <mesh position={[planet.position.x, planet.position.y, planet.position.z]}>
      <sphereGeometry args={[planet.size, 32, 32]} />
      <meshPhongMaterial
        color={`rgb(${planet.colors[0].r}, ${planet.colors[0].g}, ${planet.colors[0].b})`}
      />
    </mesh>
  );
}

function AppContent() {
  const { gameState, isConnected, error } = useGameServerContext();

  console.log('🎮 App render - gameState:', gameState ? 'loaded' : 'null', 'connected:', isConnected);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace'
      }}>
        <div>Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</div>
        {error && <div style={{ color: 'red' }}>Error: {error}</div>}
        {!gameState && isConnected && <div style={{ color: 'yellow' }}>⏳ Loading game state...</div>}
        {gameState && (
          <div>
            <div>🪐 Planets: {gameState.planets.length}</div>
            <div>👥 Players: {gameState.players.length}</div>
            <div>📍 Spawn: ({gameState.initial_player_location.x.toFixed(1)}, {gameState.initial_player_location.y.toFixed(1)}, {gameState.initial_player_location.z.toFixed(1)})</div>
          </div>
        )}
      </div>

      {gameState ? (
        <Canvas
          gl={createWebGPURenderer}
          camera={{ 
            fov: 50, 
            near: 0.1, 
            far: 20000,
            position: [
              gameState.initial_player_location.x,
              gameState.initial_player_location.y + 30,
              gameState.initial_player_location.z + 80
            ]
          }}
          style={{ width: '100vw', height: '100vh', display: 'block' }}
        >
          <Character initialPosition={gameState.initial_player_location} />

          {gameState.planets.map((planet, index) => (
            <PlanetMesh key={index} planet={planet} />
          ))}

          <ambientLight intensity={0.3} />
          <directionalLight position={[100, 100, 100]} color="white" intensity={1} />
          <directionalLight position={[-100, -100, -100]} color="white" intensity={0.5} />
        </Canvas>
      ) : (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          color: 'white',
          fontSize: '24px'
        }}>
          {isConnected ? '⏳ Loading...' : '🔌 Connecting to server...'}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <GameServerProvider>
      <AppContent />
    </GameServerProvider>
  );
}
