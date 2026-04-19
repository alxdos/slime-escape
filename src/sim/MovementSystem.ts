import type { ArenaConfig } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import type { EntityStore } from './EntityStore';
import type { RuntimeInputState } from './RuntimeInputState';

const SIM_STEP_SEC = SIM_STEP_MS / 1000;

export type MovementSystem = Readonly<{
  tick(arena: ArenaConfig, store: EntityStore, input: RuntimeInputState): void;
}>;

export function createMovementSystem(): MovementSystem {
  return {
    tick(arena, store, input) {
      const player = store.player();
      if (player === null) return;
      const { dx, dy } = input.moveDir;
      if (dx === 0 && dy === 0) return;
      const step = player.maxSpeed * SIM_STEP_SEC;
      const halfW = arena.width / 2;
      const halfH = arena.height / 2;
      const minX = -halfW + player.radius;
      const maxX = halfW - player.radius;
      const minY = -halfH + player.radius;
      const maxY = halfH - player.radius;
      player.position.x = clamp(player.position.x + dx * step, minX, maxX);
      player.position.y = clamp(player.position.y + dy * step, minY, maxY);
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
