import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig, EncounterDefinition, Vec2 } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import type { Boss, Companion, Enemy, EntityId, EntityStore, Player } from './EntityStore';

const SIM_STEP_SEC = SIM_STEP_MS / 1000;
const ALERT_DURATION_MS = 300;
const GUARD_ORBIT_RADIANS_PER_SEC = 1.1;
const REST_OFFSET_SCALE = 0.75;
const GHOST_OFFSET_SCALE = 0.5;
const ARRIVAL_EPSILON = 0.02;

type Hostile = Enemy | Boss;

export type CompanionSystem = Readonly<{
  tick(
    arena: ArenaConfig,
    store: EntityStore,
    encounter: EncounterDefinition | null,
    simTimeMs: number,
    emit?: (event: RuntimeEvent) => void
  ): void;
}>;

export function createCompanionSystem(): CompanionSystem {
  return {
    tick(arena, store, encounter, simTimeMs, emit): void {
      const companion = store.companion();
      if (companion === null) return;
      const player = store.player();
      if (player === null) {
        companion.velocity.vx = 0;
        companion.velocity.vy = 0;
        return;
      }

      if (companion.state === 'ghost') {
        tickGhostCompanion(companion, player, store, arena, simTimeMs, emit);
        return;
      }

      tickLivingCompanion(companion, player, store, arena, encounter, simTimeMs, emit);
    }
  };
}

function tickLivingCompanion(
  companion: Companion,
  player: Player,
  store: EntityStore,
  arena: ArenaConfig,
  encounter: EncounterDefinition | null,
  simTimeMs: number,
  emit: ((event: RuntimeEvent) => void) | undefined
): void {
  const previousTargetId = companion.targetId;
  const target = acquireThreat(companion, store);
  if (target === null) {
    companion.targetId = null;
  } else if (previousTargetId !== target.id) {
    companion.targetId = target.id;
    companion.alertUntilSimMs = simTimeMs + ALERT_DURATION_MS;
  }

  if (!isCombatEncounter(encounter)) {
    companion.mode = 'rest';
    companion.targetId = null;
    steerToward(companion, restPosition(player, companion), arena);
    tryBoop(companion, player, store, simTimeMs, emit);
    return;
  }

  if (target === null) {
    companion.mode = 'guard';
    steerToward(companion, guardPosition(player, companion, simTimeMs), arena);
    tryBoop(companion, player, store, simTimeMs, emit);
    return;
  }

  companion.mode = simTimeMs < companion.alertUntilSimMs ? 'alert' : 'engage';
  steerToward(companion, engagePosition(player, companion, target), arena);
  tryBoop(companion, player, store, simTimeMs, emit);
}

function tickGhostCompanion(
  companion: Companion,
  player: Player,
  store: EntityStore,
  arena: ArenaConfig,
  simTimeMs: number,
  emit: ((event: RuntimeEvent) => void) | undefined
): void {
  companion.targetId = null;
  if (distance(companion.position, player.position) <= companion.rescue.radius) {
    companion.rescueProgressMs += SIM_STEP_MS;
    if (companion.rescueProgressMs >= companion.rescue.durationMs) {
      companion.state = 'alive';
      companion.hp = Math.max(1, Math.ceil(companion.maxHp * companion.rescue.reviveHpFraction));
      companion.rescueProgressMs = 0;
      companion.mode = 'rest';
      steerToward(companion, restPosition(player, companion), arena);
      emit?.({
        kind: 'companionRescued',
        simTime: simTimeMs,
        companionId: companion.id,
        petArchetypeId: companion.petArchetypeId,
        hp: companion.hp,
        maxHp: companion.maxHp,
        x: companion.position.x,
        y: companion.position.y
      });
      tryBoop(companion, player, store, simTimeMs, emit);
      return;
    }
    companion.mode = 'rescue';
  } else {
    companion.rescueProgressMs = 0;
    companion.mode = 'ghost';
  }

  steerToward(companion, ghostPosition(player, companion), arena);
  tryBoop(companion, player, store, simTimeMs, emit);
}

function acquireThreat(companion: Companion, store: EntityStore): Hostile | null {
  const current = resolveHostileById(store, companion.targetId);
  if (
    current !== null &&
    current.hp > 0 &&
    distance(companion.position, current.position) <= companion.threat.releaseRadius
  ) {
    return current;
  }

  let best: Hostile | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hostile of hostileEntities(store)) {
    if (hostile.hp <= 0) continue;
    const candidateDistance = distance(companion.position, hostile.position);
    if (candidateDistance > companion.threat.acquireRadius) continue;
    if (
      candidateDistance < bestDistance ||
      (candidateDistance === bestDistance && (best === null || hostile.id < best.id))
    ) {
      best = hostile;
      bestDistance = candidateDistance;
    }
  }
  return best;
}

function resolveHostileById(store: EntityStore, id: EntityId | null): Hostile | null {
  if (id === null) return null;
  return store.enemyById(id) ?? store.bossById(id);
}

function* hostileEntities(store: EntityStore): IterableIterator<Hostile> {
  for (const enemy of store.enemies()) yield enemy;
  for (const boss of store.bosses()) yield boss;
}

function isCombatEncounter(encounter: EncounterDefinition | null): boolean {
  if (encounter === null) return false;
  return (
    encounter.type === 'wave' ||
    encounter.type === 'boss' ||
    encounter.type === 'survivalTimer' ||
    encounter.type === 'sandbox'
  );
}

function restPosition(player: Player, companion: Companion): Vec2 {
  const offset = companion.movement.orbitRadius * REST_OFFSET_SCALE;
  const velocityLength = Math.hypot(player.velocity.vx, player.velocity.vy);
  if (velocityLength === 0) {
    return { x: player.position.x - offset, y: player.position.y - offset };
  }
  return {
    x: player.position.x - (player.velocity.vx / velocityLength) * offset,
    y: player.position.y - (player.velocity.vy / velocityLength) * offset
  };
}

function guardPosition(player: Player, companion: Companion, simTimeMs: number): Vec2 {
  const angle =
    companion.id * 0.73 + (simTimeMs / 1000) * GUARD_ORBIT_RADIANS_PER_SEC;
  return {
    x: player.position.x + Math.cos(angle) * companion.movement.orbitRadius,
    y: player.position.y + Math.sin(angle) * companion.movement.orbitRadius
  };
}

function engagePosition(player: Player, companion: Companion, target: Hostile): Vec2 {
  const dx = target.position.x - player.position.x;
  const dy = target.position.y - player.position.y;
  const direction = normalizeOrFallback(dx, dy, { x: 1, y: 0 });
  return {
    x: player.position.x + direction.x * companion.movement.orbitRadius,
    y: player.position.y + direction.y * companion.movement.orbitRadius
  };
}

function ghostPosition(player: Player, companion: Companion): Vec2 {
  const offset = companion.movement.orbitRadius * GHOST_OFFSET_SCALE;
  return { x: player.position.x - offset, y: player.position.y - offset };
}

function steerToward(companion: Companion, desired: Vec2, arena: ArenaConfig): void {
  const dx = desired.x - companion.position.x;
  const dy = desired.y - companion.position.y;
  const dist = Math.hypot(dx, dy);
  const desiredVelocity =
    dist <= ARRIVAL_EPSILON
      ? { x: 0, y: 0 }
      : {
          x: (dx / dist) * Math.min(companion.movement.maxSpeed, dist / SIM_STEP_SEC),
          y: (dy / dist) * Math.min(companion.movement.maxSpeed, dist / SIM_STEP_SEC)
        };
  const nextVelocity = accelerateVelocity(
    { x: companion.velocity.vx, y: companion.velocity.vy },
    desiredVelocity,
    companion.movement.acceleration * SIM_STEP_SEC
  );
  companion.velocity.vx = nextVelocity.x;
  companion.velocity.vy = nextVelocity.y;
  companion.position.x += companion.velocity.vx * SIM_STEP_SEC;
  companion.position.y += companion.velocity.vy * SIM_STEP_SEC;
  clampToArena(companion, arena);
}

function accelerateVelocity(current: Vec2, desired: Vec2, maxDelta: number): Vec2 {
  const dvx = desired.x - current.x;
  const dvy = desired.y - current.y;
  const delta = Math.hypot(dvx, dvy);
  if (delta <= maxDelta || delta === 0) {
    return { x: desired.x, y: desired.y };
  }
  const scale = maxDelta / delta;
  return { x: current.x + dvx * scale, y: current.y + dvy * scale };
}

function clampToArena(companion: Companion, arena: ArenaConfig): void {
  const minX = -arena.width / 2 + companion.contactBox.width / 2;
  const maxX = arena.width / 2 - companion.contactBox.width / 2;
  const minY = -arena.height / 2 + companion.contactBox.height / 2;
  const maxY = arena.height / 2 - companion.contactBox.height / 2;
  companion.position.x = clamp(companion.position.x, minX, maxX);
  companion.position.y = clamp(companion.position.y, minY, maxY);
}

function tryBoop(
  companion: Companion,
  player: Player,
  store: EntityStore,
  simTimeMs: number,
  emit: ((event: RuntimeEvent) => void) | undefined
): void {
  if (simTimeMs < companion.boopReadyAtSimMs) return;
  const target = nearestBoopTarget(companion, store);
  if (target === null) return;
  const awayFromPlayer = normalizeOrNull(
    target.position.x - player.position.x,
    target.position.y - player.position.y
  );
  const awayFromCompanion = normalizeOrFallback(
    target.position.x - companion.position.x,
    target.position.y - companion.position.y,
    { x: 1, y: 0 }
  );
  const direction = awayFromPlayer ?? awayFromCompanion;
  const impulseSpeed = companion.boop.impulse * target.knockbackVelocityScale;
  target.knockback = {
    vx: direction.x * impulseSpeed,
    vy: direction.y * impulseSpeed,
    startSimMs: simTimeMs,
    endSimMs: simTimeMs + companion.boop.durationMs
  };
  companion.boopReadyAtSimMs = simTimeMs + companion.boop.cooldownMs;
  emit?.({
    kind: 'companionBoop',
    simTime: simTimeMs,
    companionId: companion.id,
    targetId: target.id,
    targetKind: target.kind,
    x: target.position.x,
    y: target.position.y,
    impulseDirX: direction.x,
    impulseDirY: direction.y
  });
}

function nearestBoopTarget(companion: Companion, store: EntityStore): Hostile | null {
  let best: Hostile | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hostile of hostileEntities(store)) {
    if (hostile.hp <= 0) continue;
    const candidateDistance = distance(companion.position, hostile.position);
    if (candidateDistance > companion.boop.radius) continue;
    if (
      candidateDistance < bestDistance ||
      (candidateDistance === bestDistance && (best === null || hostile.id < best.id))
    ) {
      best = hostile;
      bestDistance = candidateDistance;
    }
  }
  return best;
}

function normalizeOrNull(dx: number, dy: number): Vec2 | null {
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  return { x: dx / length, y: dy / length };
}

function normalizeOrFallback(dx: number, dy: number, fallback: Vec2): Vec2 {
  return normalizeOrNull(dx, dy) ?? fallback;
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
