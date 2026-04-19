import { assertNever } from '../shared/protocol';
import type { ArenaConfig } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import type { Enemy, EntityStore, Player } from './EntityStore';
import type { RuntimeInputState } from './RuntimeInputState';

const SIM_STEP_SEC = SIM_STEP_MS / 1000;

export type MovementSystem = Readonly<{
  tick(
    arena: ArenaConfig,
    store: EntityStore,
    input: RuntimeInputState,
    simTimeMs: number
  ): void;
}>;

export function createMovementSystem(): MovementSystem {
  return {
    tick(arena, store, input, simTimeMs): void {
      const player = store.player();
      if (player !== null) tickPlayer(arena, player, input);
      tickEnemies(store, player, simTimeMs);
    }
  };
}

function tickPlayer(arena: ArenaConfig, player: Player, input: RuntimeInputState): void {
  const { dx, dy } = input.moveDir;
  const vx = dx * player.maxSpeed;
  const vy = dy * player.maxSpeed;
  player.velocity.vx = vx;
  player.velocity.vy = vy;
  if (vx === 0 && vy === 0) return;
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  const minX = -halfW + player.radius;
  const maxX = halfW - player.radius;
  const minY = -halfH + player.radius;
  const maxY = halfH - player.radius;
  player.position.x = clamp(player.position.x + vx * SIM_STEP_SEC, minX, maxX);
  player.position.y = clamp(player.position.y + vy * SIM_STEP_SEC, minY, maxY);
}

function tickEnemies(store: EntityStore, player: Player | null, simTimeMs: number): void {
  for (const enemy of store.enemies()) {
    if (tickKnockback(enemy, simTimeMs)) continue;
    tickEnemyBehavior(enemy, player);
  }
}

function tickKnockback(enemy: Enemy, simTimeMs: number): boolean {
  const knockback = enemy.knockback;
  if (knockback === null) return false;
  if (simTimeMs >= knockback.endSimMs) {
    enemy.knockback = null;
    return false;
  }
  const elapsed = simTimeMs - knockback.startSimMs;
  const duration = knockback.endSimMs - knockback.startSimMs;
  const decay = duration > 0 ? Math.max(0, 1 - elapsed / duration) : 0;
  const vx = knockback.vx * decay;
  const vy = knockback.vy * decay;
  enemy.position.x += vx * SIM_STEP_SEC;
  enemy.position.y += vy * SIM_STEP_SEC;
  enemy.velocity.vx = vx;
  enemy.velocity.vy = vy;
  return true;
}

function tickEnemyBehavior(enemy: Enemy, player: Player | null): void {
  switch (enemy.behavior) {
    case 'stationary':
      enemy.velocity.vx = 0;
      enemy.velocity.vy = 0;
      return;
    case 'chase': {
      if (player === null) {
        enemy.velocity.vx = 0;
        enemy.velocity.vy = 0;
        return;
      }
      const dx = player.position.x - enemy.position.x;
      const dy = player.position.y - enemy.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        enemy.velocity.vx = 0;
        enemy.velocity.vy = 0;
        return;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const vx = nx * enemy.maxSpeed;
      const vy = ny * enemy.maxSpeed;
      enemy.position.x += vx * SIM_STEP_SEC;
      enemy.position.y += vy * SIM_STEP_SEC;
      enemy.velocity.vx = vx;
      enemy.velocity.vy = vy;
      return;
    }
    default:
      assertNever(enemy.behavior);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
