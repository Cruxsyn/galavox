import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useGameServer } from '../hooks/useGameServer';
import type { GameState } from '../types/gameState';

interface GameServerContextType {
  gameState: GameState | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  sendPosition: (x: number, y: number, z: number) => void;
}

const GameServerContext = createContext<GameServerContextType | undefined>(undefined);

export function GameServerProvider({ children }: { children: ReactNode }) {
  const gameServer = useGameServer();

  return (
    <GameServerContext.Provider value={gameServer}>
      {children}
    </GameServerContext.Provider>
  );
}

export function useGameServerContext() {
  const context = useContext(GameServerContext);
  if (context === undefined) {
    throw new Error('useGameServerContext must be used within a GameServerProvider');
  }
  return context;
}

