import type { Loadout, PlayerConfig } from '../session';

export type RuntimeLoadoutState = {
  weapons: ReadonlyArray<string>;
  selectedIndex: number | null;
};

export type RuntimeActorInputState = {
  moveDir: { dx: number; dy: number };
  aimWorld: { x: number; y: number };
  firing: boolean;
  loadout: RuntimeLoadoutState | null;
};

export type RuntimeInputState = {
  players: Map<string, RuntimeActorInputState>;
};

export function createRuntimeInputState(): RuntimeInputState {
  return {
    players: new Map()
  };
}

export function createRuntimeActorInputState(
  aimX = 0,
  aimY = 0,
  loadout: Loadout | null = null
): RuntimeActorInputState {
  return {
    moveDir: { dx: 0, dy: 0 },
    aimWorld: { x: aimX, y: aimY },
    firing: false,
    loadout: copyLoadout(loadout)
  };
}

export function resetRuntimeInputState(
  state: RuntimeInputState,
  players: ReadonlyArray<PlayerConfig>
): void {
  state.players.clear();
  for (const player of players) {
    state.players.set(
      player.id,
      createRuntimeActorInputState(player.position.x, player.position.y, player.loadout)
    );
  }
}

export function runtimeInputForPlayer(
  state: RuntimeInputState,
  playerId: string
): RuntimeActorInputState | null {
  return state.players.get(playerId) ?? null;
}

function copyLoadout(loadout: Loadout | null): RuntimeLoadoutState | null {
  return loadout === null
    ? null
    : {
        weapons: [...loadout.weapons],
        selectedIndex: loadout.selectedIndex
      };
}
