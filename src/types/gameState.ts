// Types matching the Rust server structures

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface Planet {
  readonly size: number;
  readonly colors: readonly [Color, Color, Color]; // 3 colors
  readonly module_type: number;
  readonly position: Position;
}

export interface Player {
  id: number;
  name: string;
  level: number;
  position: Position;
}

export interface GameState {
  readonly planets: readonly Planet[];
  players: Player[]; // Mutable - needs to be updated as players move
  readonly initial_player_location: Position;
}

// Deep freeze utility to make objects truly immutable at runtime
export function deepFreeze<T>(obj: T): Readonly<T> {
  // Freeze the object itself
  Object.freeze(obj);

  // Recursively freeze all properties
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return obj;
}

