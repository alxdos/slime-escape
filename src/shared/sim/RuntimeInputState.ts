import type { Loadout } from '../session';

export type RuntimeLoadoutState = {
  weapons: ReadonlyArray<string>;
  selectedIndex: number | null;
};

export type RuntimeInputState = {
  moveDir: { dx: number; dy: number };
  aimWorld: { x: number; y: number };
  firing: boolean;
  loadout: RuntimeLoadoutState | null;
};

export function createRuntimeInputState(): RuntimeInputState {
  return {
    moveDir: { dx: 0, dy: 0 },
    aimWorld: { x: 0, y: 0 },
    firing: false,
    loadout: null
  };
}

export function resetRuntimeInputState(
  state: RuntimeInputState,
  aimX: number,
  aimY: number,
  loadout: Loadout | null = null
): void {
  state.moveDir.dx = 0;
  state.moveDir.dy = 0;
  state.aimWorld.x = aimX;
  state.aimWorld.y = aimY;
  state.firing = false;
  state.loadout =
    loadout === null
      ? null
      : {
          weapons: [...loadout.weapons],
          selectedIndex: loadout.selectedIndex
        };
}
