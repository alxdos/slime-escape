export type RuntimeInputState = {
  moveDir: { dx: number; dy: number };
  aimWorld: { x: number; y: number };
  firing: boolean;
};

export function createRuntimeInputState(): RuntimeInputState {
  return {
    moveDir: { dx: 0, dy: 0 },
    aimWorld: { x: 0, y: 0 },
    firing: false
  };
}

export function resetRuntimeInputState(
  state: RuntimeInputState,
  aimX: number,
  aimY: number
): void {
  state.moveDir.dx = 0;
  state.moveDir.dy = 0;
  state.aimWorld.x = aimX;
  state.aimWorld.y = aimY;
  state.firing = false;
}
