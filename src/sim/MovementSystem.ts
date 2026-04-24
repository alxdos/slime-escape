import { assertNever } from '../shared/protocol';
import type { ArenaConfig } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import type { Boss, Enemy, EntityStore, Player } from './EntityStore';
import type { RuntimeInputState } from './RuntimeInputState';
import { resolveMovementSpeedMultiplier } from './StatusEffectSystem';

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
      tickBosses(store, player, simTimeMs);
    }
  };
}

function tickPlayer(arena: ArenaConfig, player: Player, input: RuntimeInputState): void {
  const { dx, dy } = input.moveDir;
  const speedMultiplier = resolveMovementSpeedMultiplier(player);
  const vx = dx * player.maxSpeed * speedMultiplier;
  const vy = dy * player.maxSpeed * speedMultiplier;
  player.velocity.vx = vx;
  player.velocity.vy = vy;
  if (vx === 0 && vy === 0) return;
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  const halfContactWidth = player.contactBox.width / 2;
  const halfContactHeight = player.contactBox.height / 2;
  const minX = -halfW + halfContactWidth;
  const maxX = halfW - halfContactWidth;
  const minY = -halfH + halfContactHeight;
  const maxY = halfH - halfContactHeight;
  player.position.x = clamp(player.position.x + vx * SIM_STEP_SEC, minX, maxX);
  player.position.y = clamp(player.position.y + vy * SIM_STEP_SEC, minY, maxY);
}

function tickEnemies(store: EntityStore, player: Player | null, simTimeMs: number): void {
  for (const enemy of store.enemies()) {
    if (tickKnockbackCarrier(enemy, simTimeMs)) continue;
    tickEnemyBehavior(enemy, resolveEnemyTarget(enemy, store, player, simTimeMs));
  }
}

function tickBosses(store: EntityStore, player: Player | null, simTimeMs: number): void {
  for (const boss of store.bosses()) {
    if (tickKnockbackCarrier(boss, simTimeMs)) continue;
    chaseTowardPlayer(boss, player);
  }
}

function chaseTowardPlayer(actor: Enemy | Boss, target: Player | Enemy | Boss | null): void {
  if ('behavior' in actor && actor.behavior === 'stationary') {
    actor.velocity.vx = 0;
    actor.velocity.vy = 0;
    return;
  }
  if (target === null) {
    actor.velocity.vx = 0;
    actor.velocity.vy = 0;
    return;
  }
  const dx = target.position.x - actor.position.x;
  const dy = target.position.y - actor.position.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) {
    actor.velocity.vx = 0;
    actor.velocity.vy = 0;
    return;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const speedMultiplier = resolveMovementSpeedMultiplier(actor);
  const vx = nx * actor.maxSpeed * speedMultiplier;
  const vy = ny * actor.maxSpeed * speedMultiplier;
  actor.position.x += vx * SIM_STEP_SEC;
  actor.position.y += vy * SIM_STEP_SEC;
  actor.velocity.vx = vx;
  actor.velocity.vy = vy;
}

function tickKnockbackCarrier(actor: Enemy | Boss, simTimeMs: number): boolean {
  const knockback = actor.knockback;
  if (knockback === null) return false;
  if (simTimeMs >= knockback.endSimMs) {
    actor.knockback = null;
    return false;
  }
  const elapsed = simTimeMs - knockback.startSimMs;
  const duration = knockback.endSimMs - knockback.startSimMs;
  const decay = duration > 0 ? Math.max(0, 1 - elapsed / duration) : 0;
  const vx = knockback.vx * decay;
  const vy = knockback.vy * decay;
  actor.position.x += vx * SIM_STEP_SEC;
  actor.position.y += vy * SIM_STEP_SEC;
  actor.velocity.vx = vx;
  actor.velocity.vy = vy;
  return true;
}

function tickEnemyBehavior(enemy: Enemy, target: Player | Enemy | Boss | null): void {
  switch (enemy.behavior) {
    case 'stationary':
      enemy.velocity.vx = 0;
      enemy.velocity.vy = 0;
      return;
    case 'chase':
      chaseTowardPlayer(enemy, target);
      return;
    default:
      assertNever(enemy.behavior);
  }
}

function resolveEnemyTarget(
  enemy: Enemy,
  store: EntityStore,
  player: Player | null,
  simTimeMs: number
): Player | Enemy | Boss | null {
  const aggro = enemy.aggroMemory;
  if (aggro === null) return player;
  if (simTimeMs >= aggro.expireAtSimMs) {
    enemy.aggroMemory = null;
    return player;
  }
  const aggroEnemy = store.enemyById(aggro.targetId);
  if (aggroEnemy !== null) return aggroEnemy;
  const aggroBoss = store.bossById(aggro.targetId);
  if (aggroBoss !== null) return aggroBoss;
  const currentPlayer = store.player();
  if (currentPlayer !== null && currentPlayer.id === aggro.targetId) return currentPlayer;
  enemy.aggroMemory = null;
  return player;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
