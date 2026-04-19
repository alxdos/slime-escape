import type { PlayerSpawn } from '../shared/session';

export type EntityId = number & { readonly __brand: 'EntityId' };

export type Player = {
  readonly id: EntityId;
  readonly radius: number;
  readonly maxSpeed: number;
  position: { x: number; y: number };
};

export type EntityStore = Readonly<{
  spawnPlayer(spec: PlayerSpawn): Player;
  player(): Player | null;
  clear(): void;
}>;

export function createEntityStore(): EntityStore {
  let nextId = 1;
  let player: Player | null = null;

  function makeId(): EntityId {
    const id = nextId as EntityId;
    nextId += 1;
    return id;
  }

  return {
    spawnPlayer(spec): Player {
      if (player !== null) {
        throw new Error('player already spawned');
      }
      const next: Player = {
        id: makeId(),
        radius: spec.radius,
        maxSpeed: spec.maxSpeed,
        position: { x: spec.position.x, y: spec.position.y }
      };
      player = next;
      return next;
    },
    player(): Player | null {
      return player;
    },
    clear(): void {
      player = null;
      nextId = 1;
    }
  };
}
