import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, Planet } from '../types/gameState';
import { deepFreeze } from '../types/gameState';

interface UseGameServerReturn {
  gameState: GameState | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  sendPosition: (x: number, y: number, z: number) => void;
}

export function useGameServer(url: string = 'ws://localhost:8080'): UseGameServerReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {

    // Wait 100ms before starting connection to avoid thrashing/rapid reconnects
    if (wsRef.current) {
      // If there's an existing socket, don't delay
    } else {
      const start = Date.now();
      while (Date.now() - start < 100) {}
    }
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('⚠️ Already connected or connecting, skipping...');
      return wsRef.current;
    }

    try {
      isConnectingRef.current = true;
      console.log('🚀 Connecting to Crux Server...');
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('✅ Connected to server!');
        setIsConnected(true);
        setError(null);
        isConnectingRef.current = false;
      };

      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          // Text message from server
          console.log('💬 Server:', event.data);
        } else if (event.data instanceof Blob) {
          // Binary data - need to parse it
          console.log('📦 Received binary game state');
          
          // Read the blob as array buffer
          event.data.arrayBuffer().then((buffer) => {
            try {
              const decoded = decodeBincodeGameState(buffer);
              setGameState(decoded);
              console.log('🌍 Game State Loaded:', decoded);
            } catch (err) {
              console.error('❌ Failed to decode game state:', err);
              setError('Failed to decode game state');
            }
          });
        }
      };

      socket.onerror = (event) => {
        console.error('❌ WebSocket error:', event);
        setError('WebSocket connection error');
        setIsConnected(false);
        isConnectingRef.current = false;
      };

      socket.onclose = () => {
        console.log('👋 Connection closed');
        setIsConnected(false);
        isConnectingRef.current = false;
        wsRef.current = null;
      };

      return socket;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      console.error('Failed to connect:', err);
      isConnectingRef.current = false;
      return null;
    }
  }, [url]);

  useEffect(() => {
    const socket = connect();

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log('🔌 Closing WebSocket connection...');
        socket.close();
      }
      wsRef.current = null;
      isConnectingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array - only connect once

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    isConnectingRef.current = false;
    connect();
  }, [connect]);

  const sendPosition = useCallback((x: number, y: number, z: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Encode position as binary (3 floats = 12 bytes)
      const buffer = new ArrayBuffer(12);
      const view = new DataView(buffer);
      view.setFloat32(0, x, true);  // little-endian
      view.setFloat32(4, y, true);
      view.setFloat32(8, z, true);
      wsRef.current.send(buffer);
    }
  }, []);

  return { gameState, isConnected, error, reconnect, sendPosition };
}

// Temporary decoder function - this is a simplified version
// For production, you'd want to use a proper bincode library or have the server send JSON
function decodeBincodeGameState(buffer: ArrayBuffer): GameState {
  const view = new DataView(buffer);
  let offset = 0;

  // Helper to read different types
  const readU64 = () => {
    const value = view.getBigUint64(offset, true);
    offset += 8;
    return Number(value);
  };

  const readU32 = () => {
    const value = view.getUint32(offset, true);
    offset += 4;
    return value;
  };

  const readU8 = () => {
    const value = view.getUint8(offset);
    offset += 1;
    return value;
  };

  const readF32 = () => {
    const value = view.getFloat32(offset, true);
    offset += 4;
    return value;
  };

  const readString = () => {
    const len = readU64();
    const bytes = new Uint8Array(buffer, offset, len);
    offset += len;
    return new TextDecoder().decode(bytes);
  };

  const readPosition = () => {
    return {
      x: readF32(),
      y: readF32(),
      z: readF32(),
    };
  };

  const readColor = () => {
    const color = {
      r: readU8(),
      g: readU8(),
      b: readU8(),
    };
    return deepFreeze(color);
  };

  const readPlanet = () => {
    const planet = {
      size: readF32(),
      colors: [readColor(), readColor(), readColor()] as [any, any, any],
      module_type: readU8(),
      position: readPosition(),
    };
    return deepFreeze(planet);
  };

  const readPlayer = () => {
    // Don't freeze players - they need to be mutable
    return {
      id: readU32(),
      name: readString(),
      level: readU32(),
      position: readPosition(),
    };
  };

  // Read planets array
  const planetCount = readU64();
  const planets = [];
  for (let i = 0; i < planetCount; i++) {
    planets.push(readPlanet());
  }

  // Read players array
  const playerCount = readU64();
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push(readPlayer());
  }

  // Read initial player location
  const initial_player_location = readPosition();

  // Freeze planets but keep players mutable
  const gameState: GameState = {
    planets: Object.freeze(planets) as readonly Planet[],
    players: players, // Keep mutable
    initial_player_location,
  };

  return gameState;
}

