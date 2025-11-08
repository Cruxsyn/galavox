import { Canvas, useThree } from "@react-three/fiber";
import { useGameServerStore } from "./stores/gameServerStore";
import { useGameServer } from "./hooks/useGameServer";
import type { Planet } from "./types/gameState";
import Character from "./character";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  float,
  vec3,
  mix,
  sin,
  smoothstep,
  positionLocal,
  cos,
} from "three/tsl";

function SceneSetup() {
  const { invalidate, gl, size } = useThree();

  // Ensure renderer size stays in sync with canvas size
  useEffect(() => {
    const canvas = gl.domElement;
    if (canvas instanceof HTMLCanvasElement) {
      const updateSize = () => {
        const rect = canvas.getBoundingClientRect();
        // Use actual pixel dimensions from getBoundingClientRect
        const width = Math.floor(rect.width) || size.width;
        const height = Math.floor(rect.height) || size.height;
        
        if (width > 0 && height > 0) {
          const currentSize = new THREE.Vector2();
          gl.getSize(currentSize);
          // Only update if size actually changed (avoid unnecessary updates)
          if (Math.abs(currentSize.width - width) > 1 || Math.abs(currentSize.height - height) > 1) {
            // For WebGPU, we need to ensure the swap chain updates
            // setSize should handle this, but we'll force it
            gl.setSize(width, height, false);
            
            // For WebGPU renderer, we may need to wait a frame for swap chain to update
            if (gl instanceof WebGPURenderer) {
              requestAnimationFrame(() => {
                invalidate(); // Force re-render after swap chain updates
              });
            } else {
              invalidate(); // Immediate invalidate for WebGL
            }
          }
        }
      };

      // Set initial size immediately with a small delay to ensure canvas is laid out
      requestAnimationFrame(() => {
        updateSize();
      });

      // Use ResizeObserver to watch canvas size changes
      const resizeObserver = new ResizeObserver(() => {
        // Use requestAnimationFrame to batch updates
        requestAnimationFrame(updateSize);
      });
      resizeObserver.observe(canvas);

      // Also listen to window resize as fallback
      window.addEventListener('resize', updateSize);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [gl, size, invalidate]);

  // Force initial render after mount
  useEffect(() => {
    const timer = setTimeout(() => invalidate(), 100);
    return () => clearTimeout(timer);
  }, [invalidate]);

  return null;
}

// Inline WebGPU renderer init
async function createWebGPURenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas
) {
  // Get initial size to prevent 0x0 renderer
  // Use integer pixel dimensions (critical for WebGPU swap chain)
  const getInitialSize = () => {
    if (canvas instanceof OffscreenCanvas) {
      return { width: canvas.width || 800, height: canvas.height || 600 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      width: Math.floor(rect.width || canvas.clientWidth || canvas.offsetWidth || window.innerWidth || 800),
      height: Math.floor(rect.height || canvas.clientHeight || canvas.offsetHeight || window.innerHeight || 600),
    };
  };

  const { width, height } = getInitialSize();
  let renderer: WebGPURenderer | THREE.WebGLRenderer;

  if ("gpu" in navigator) {
    try {
      const webgpuRenderer = new WebGPURenderer({ canvas, antialias: true });
      webgpuRenderer.setClearColor(new THREE.Color(0x000000));
      webgpuRenderer.outputColorSpace = THREE.SRGBColorSpace;
      
      // Set initial size before init to prevent black screen
      webgpuRenderer.setSize(width, height);
      webgpuRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      // WebGPU renderer needs async initialization
      await webgpuRenderer.init();
      
      renderer = webgpuRenderer;
      console.log("✅ WebGPU Renderer initialized");
    } catch (err) {
      console.warn("⚠️ WebGPU init failed, falling back to WebGL:", err);
      const webglRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      webglRenderer.setClearColor(new THREE.Color(0x000000));
      webglRenderer.setSize(width, height);
      webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer = webglRenderer;
    }
  } else {
    console.warn("❌ WebGPU not supported, using WebGL fallback");
    const webglRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    webglRenderer.setClearColor(new THREE.Color(0x000000));
    webglRenderer.setSize(width, height);
    webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer = webglRenderer;
  }

  return renderer;
}

interface PlanetMeshProps {
  planet: Planet;
}

function PlanetMesh({ planet }: PlanetMeshProps) {
  const material = useMemo(() => {
    const colorOcean = vec3(
      planet.colors[0].r / 255,
      planet.colors[0].g / 255,
      planet.colors[0].b / 255
    );
    const colorLand = vec3(
      planet.colors[1].r / 255,
      planet.colors[1].g / 255,
      planet.colors[1].b / 255
    );
    const colorMountain = vec3(
      planet.colors[2].r / 255,
      planet.colors[2].g / 255,
      planet.colors[2].b / 255
    );

    const pos = positionLocal.normalize();

    const wave1 = sin(pos.x.mul(2.1))
      .add(cos(pos.y.mul(1.9)))
      .add(sin(pos.z.mul(2.3)));

    const wave2 = sin(pos.x.mul(5.7))
      .add(cos(pos.y.mul(6.1)))
      .add(sin(pos.z.mul(5.3)))
      .mul(0.5);

    const wave3 = sin(pos.x.mul(11.3))
      .add(cos(pos.y.mul(12.7)))
      .add(sin(pos.z.mul(11.9)))
      .mul(0.25);

    const combined = wave1.add(wave2).add(wave3).mul(0.4);

    const landMask = smoothstep(float(0.2), float(0.5), combined);
    const mountainMask = smoothstep(float(0.6), float(0.8), combined);

    const landColor = mix(colorOcean, colorLand, landMask);
    const finalColor = mix(landColor, colorMountain, mountainMask);

    const mat = new MeshStandardNodeMaterial();
    // @ts-ignore node hooks
    mat.colorNode = finalColor;
    mat.roughness = 0.8;
    mat.metalness = 0.0;
    mat.side = THREE.FrontSide;
    return mat;
  }, [planet.colors]);

  return (
    <mesh
      position={[planet.position.x, planet.position.y, planet.position.z]}
      material={material}
    >
      <sphereGeometry args={[planet.size, 64, 64]} />
    </mesh>
  );
}

function AppContent() {
  useGameServer();
  const gameState = useGameServerStore((s) => s.gameState);
  const isConnected = useGameServerStore((s) => s.isConnected);
  const error = useGameServerStore((s) => s.error);

  console.log(
    "🎮 App render - gameState:",
    gameState ? "loaded" : "null",
    "connected:",
    isConnected
  );

  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "#000" }}>
      {/* HUD */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 1000,
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "10px",
          borderRadius: "5px",
          fontFamily: "monospace",
        }}
      >
        <div>Status: {isConnected ? "✅ Connected" : "❌ Disconnected"}</div>
        {error && <div style={{ color: "red" }}>Error: {error}</div>}
        {!gameState && isConnected && (
          <div style={{ color: "yellow" }}>⏳ Loading game state...</div>
        )}
        {gameState && (
          <div>
            <div>🪐 Planets: {gameState.planets.length}</div>
            <div>👥 Players: {gameState.players.length}</div>
            <div>
              📍 Spawn: (
              {gameState.initial_player_location.x.toFixed(1)},
              {gameState.initial_player_location.y.toFixed(1)},
              {gameState.initial_player_location.z.toFixed(1)})
            </div>
          </div>
        )}
      </div>

      {/* Always mount Canvas to ensure proper sizing from the start */}
      <div style={{ 
        width: "100vw", 
        height: "100vh", 
        position: "relative",
      }}>
        <Canvas
          gl={async ({ canvas }) => {
            if (canvas instanceof HTMLCanvasElement) {
              return await createWebGPURenderer(canvas);
            }
            // Fallback for OffscreenCanvas
            const webglRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            webglRenderer.setClearColor(new THREE.Color(0x000000));
            webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            const size = { width: (canvas as any).width || 800, height: (canvas as any).height || 600 };
            webglRenderer.setSize(size.width, size.height);
            return webglRenderer;
          }}
          frameloop="always"
          camera={gameState ? {
            fov: 50,
            near: 0.1,
            far: 20000,
            position: [
              gameState.initial_player_location.x,
              gameState.initial_player_location.y + 30,
              gameState.initial_player_location.z + 80,
            ],
          } : {
            fov: 50,
            near: 0.1,
            far: 20000,
            position: [0, 0, 0],
          }}
          style={{ width: "100vw", height: "100vh", display: "block" }}
          onCreated={({ gl, size, invalidate }) => {
            // Ensure renderer size matches canvas size exactly
            // This is critical for WebGPU to avoid texture size mismatches
            const canvas = gl.domElement;
            if (canvas instanceof HTMLCanvasElement) {
              // Wait for canvas to be fully in DOM and laid out
              // Use multiple RAFs to ensure proper sizing after conditional render
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    const rect = canvas.getBoundingClientRect();
                    // Use floor to ensure integer pixel dimensions (important for WebGPU)
                    const width = Math.floor(rect.width) || size.width;
                    const height = Math.floor(rect.height) || size.height;
                    
                    if (width > 0 && height > 0) {
                      // Set size - this should update the WebGPU swap chain
                      gl.setSize(width, height, false); // false = don't update style
                      gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                      
                      // For WebGPU, wait an extra frame for swap chain to fully update
                      if (gl instanceof WebGPURenderer) {
                        requestAnimationFrame(() => {
                          invalidate();
                        });
                      } else {
                        invalidate();
                      }
                    }
                  });
                });
              });
            } else {
              gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            }
          }}
        >
          <SceneSetup />
          {gameState && (
            <>
              <Character initialPosition={gameState.initial_player_location} />
              {gameState.planets.map((planet, i) => (
                <PlanetMesh key={i} planet={planet} />
              ))}
            </>
          )}
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[100, 100, 100]}
            color="white"
            intensity={1}
          />
          <directionalLight
            position={[-100, -100, -100]}
            color="white"
            intensity={0.5}
          />
        </Canvas>
      </div>
      
      {/* Loading overlay */}
      {!gameState && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000",
            color: "white",
            fontSize: "24px",
            zIndex: 100,
          }}
        >
          {isConnected ? "⏳ Loading..." : "🔌 Connecting to server..."}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
