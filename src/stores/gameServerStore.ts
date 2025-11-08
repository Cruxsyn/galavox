import { create } from 'zustand';
import type { GameState } from '../types/gameState';

interface GameServerStore {
  gameState: GameState | null;
  isConnected: boolean;
  error: string | null;
  setGameState: (gameState: GameState | null) => void;
  setIsConnected: (isConnected: boolean) => void;
  setError: (error: string | null) => void;
  reconnect: () => void;
  sendPosition: (x: number, y: number, z: number) => void;
  // Internal WebSocket reference stored in the hook, but we need a way to access it
  _wsRef: WebSocket | null;
  setWsRef: (ws: WebSocket | null) => void;
  _connectFn: (() => void) | null;
  setConnectFn: (fn: (() => void) | null) => void;
}

export const useGameServerStore = create<GameServerStore>((set, get) => ({
  gameState: null,
  isConnected: false,
  error: null,
  _wsRef: null,
  _connectFn: null,
  
  setGameState: (gameState) => set({ gameState }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setError: (error) => set({ error }),
  
  setWsRef: (ws) => set({ _wsRef: ws }),
  setConnectFn: (fn) => set({ _connectFn: fn }),
  
  reconnect: () => {
    const { _connectFn } = get();
    if (_connectFn) {
      _connectFn();
    }
  },
  
  sendPosition: (x: number, y: number, z: number) => {
    const { _wsRef } = get();
    if (_wsRef && _wsRef.readyState === WebSocket.OPEN) {
      // Encode position as binary (3 floats = 12 bytes)
      const buffer = new ArrayBuffer(12);
      const view = new DataView(buffer);
      view.setFloat32(0, x, true);  // little-endian
      view.setFloat32(4, y, true);
      view.setFloat32(8, z, true);
      _wsRef.send(buffer);
    }
  },
}));

