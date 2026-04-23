import { ENEMY_ARCHETYPES } from '../shared/content/enemies';
import { WEAPON_ARCHETYPES, type WeaponArchetype } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig, Loadout, Vec2 } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import type { Boss, Enemy, EntityId, EntityStore, Player, Projectile } from './EntityStore';
import type { RuntimeInputState } from './RuntimeInputState';
import type { IndexedEntity, SpatialIndex } from './SpatialIndex';

const SIM_STEP_SEC = SIM_STEP_MS / 1000;

export type DamageSource =
  | {
      kind: 'projectile';
      projectileId: EntityId;
      ownerKind: 'player' | 'enemy' | 'boss';
      weaponArchetypeId: string;
    }
  | { kind: 'enemyContact'; enemyId: EntityId }
  | { kind: 'environment'; tag: string }
  | { kind: 'boss'; bossId: EntityId; attackId: string };

export type DamageIntent = Readonly<{
  targetId: EntityId;
  amount: number;
  source: DamageSource;
  hitPosition: Vec2;
}>;

type ShooterWeapons = {
  primary: { archetype: WeaponArchetype; nextFireSimMs: number };
};

export type CombatSystem = Readonly<{
  setPlayerLoadout(playerId: EntityId, loadout: Loadout, simTimeMs: number): void;
  clear(): void;
  tick(
    input: RuntimeInputState,
    store: EntityStore,
    index: SpatialIndex,
    simTimeMs: number,
    arena: ArenaConfig,
    emit: (event: RuntimeEvent) => void
  ): ReadonlyArray<DamageIntent>;
}>;

export function createCombatSystem(
  weaponRegistry: Readonly<Record<string, WeaponArchetype>> = WEAPON_ARCHETYPES
): CombatSystem {
  const shooterWeapons = new Map<EntityId, ShooterWeapons>();

  return {
    setPlayerLoadout(playerId, loadout, simTimeMs): void {
      const archetype = weaponRegistry[loadout.primaryWeaponArchetypeId];
      if (archetype === undefined) {
        throw new Error(
          `unknown weapon archetype on session start: ${loadout.primaryWeaponArchetypeId}`
        );
      }
      shooterWeapons.set(playerId, {
        primary: { archetype, nextFireSimMs: simTimeMs }
      });
    },
    clear(): void {
      shooterWeapons.clear();
    },
    tick(input, store, index, simTimeMs, arena, emit): ReadonlyArray<DamageIntent> {
      const maxContactBoundsRadius = computeMaxContactBoundsRadius(store);
      const maxProjectileTargetRadius = computeMaxProjectileTargetRadius(store);
      runFiringDecisions(input, store, simTimeMs, shooterWeapons, emit);
      runProjectileMovement(store);
      runLifetimeCleanup(store, simTimeMs, arena);
      index.rebuild(store);
      const contactIntents = runContactIntents(store, index, simTimeMs, maxContactBoundsRadius);
      const projectileIntents = runHitDetection(
        store,
        index,
        simTimeMs,
        maxProjectileTargetRadius,
        emit
      );
      return contactIntents.length === 0
        ? projectileIntents
        : [...contactIntents, ...projectileIntents];
    }
  };
}

function runFiringDecisions(
  input: RuntimeInputState,
  store: EntityStore,
  simTimeMs: number,
  shooterWeapons: Map<EntityId, ShooterWeapons>,
  emit: (event: RuntimeEvent) => void
): void {
  const player = store.player();
  if (player === null) return;
  if (!input.firing) return;

  const weapons = shooterWeapons.get(player.id);
  if (weapons === undefined) return;
  if (simTimeMs < weapons.primary.nextFireSimMs) return;

  const { archetype } = weapons.primary;

  const dx = input.aimWorld.x - player.position.x;
  const dy = input.aimWorld.y - player.position.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const dirX = dx / len;
  const dirY = dy / len;

  store.spawnProjectile({
    weaponArchetypeId: archetype.id,
    ownerKind: 'player',
    position: { x: player.position.x, y: player.position.y },
    velocity: {
      vx: dirX * archetype.projectileSpeed,
      vy: dirY * archetype.projectileSpeed
    },
    radius: archetype.projectileRadius,
    damage: archetype.damage,
    expireAtSimMs: simTimeMs + archetype.projectileTtlMs
  });

  weapons.primary.nextFireSimMs = simTimeMs + archetype.cooldownMs;

  emit({
    kind: 'fire',
    simTime: simTimeMs,
    shooterId: player.id,
    ownerKind: 'player',
    weaponArchetypeId: archetype.id,
    originX: player.position.x,
    originY: player.position.y,
    dirX,
    dirY
  });
}

function runProjectileMovement(store: EntityStore): void {
  for (const projectile of store.projectiles()) {
    projectile.position.x += projectile.velocity.vx * SIM_STEP_SEC;
    projectile.position.y += projectile.velocity.vy * SIM_STEP_SEC;
  }
}

function runLifetimeCleanup(store: EntityStore, simTimeMs: number, arena: ArenaConfig): void {
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  const expired: EntityId[] = [];
  for (const projectile of store.projectiles()) {
    if (simTimeMs >= projectile.expireAtSimMs) {
      expired.push(projectile.id);
      continue;
    }
    const { x, y } = projectile.position;
    if (x < -halfW || x > halfW || y < -halfH || y > halfH) {
      expired.push(projectile.id);
    }
  }
  for (const id of expired) store.removeProjectile(id);
}

function runContactIntents(
  store: EntityStore,
  index: SpatialIndex,
  simTimeMs: number,
  maxEnemyContactBoundsRadius: number
): DamageIntent[] {
  const player = store.player();
  if (player === null) return [];
  const intents: DamageIntent[] = [];
  const range = contactBoundsRadius(player) + maxEnemyContactBoundsRadius;
  const candidates = index.queryRadius(player.position.x, player.position.y, range);
  for (const candidate of candidates) {
    if (candidate.kind !== 'enemy' && candidate.kind !== 'boss') continue;
    const enemy = candidate;
    if (enemy.contactDamage <= 0) continue;
    if (simTimeMs < enemy.nextContactSimMs) continue;
    if (!boxesOverlap(player, enemy)) continue;
    intents.push({
      targetId: player.id,
      amount: enemy.contactDamage,
      source: { kind: 'enemyContact', enemyId: enemy.id },
      hitPosition: { x: player.position.x, y: player.position.y }
    });
    enemy.nextContactSimMs = simTimeMs + enemy.contactCooldownMs;
    applyKnockbackToChaser(enemy, player, simTimeMs);
  }
  return intents;
}

function applyKnockbackToChaser(enemy: Enemy | Boss, player: Player, simTimeMs: number): void {
  const ndx = enemy.position.x - player.position.x;
  const ndy = enemy.position.y - player.position.y;
  const dist = Math.hypot(ndx, ndy);
  let nx: number;
  let ny: number;
  if (dist > 0) {
    nx = ndx / dist;
    ny = ndy / dist;
  } else {
    const vlen = Math.hypot(enemy.velocity.vx, enemy.velocity.vy);
    if (vlen > 0) {
      nx = enemy.velocity.vx / vlen;
      ny = enemy.velocity.vy / vlen;
    } else {
      nx = 1;
      ny = 0;
    }
  }
  const approachSpeed = Math.max(
    0,
    (player.velocity.vx - enemy.velocity.vx) * nx + (player.velocity.vy - enemy.velocity.vy) * ny
  );
  const impulseSpeed =
    enemy.knockbackBaseImpulse + enemy.knockbackVelocityScale * approachSpeed;
  enemy.knockback = {
    vx: impulseSpeed * nx,
    vy: impulseSpeed * ny,
    startSimMs: simTimeMs,
    endSimMs: simTimeMs + enemy.knockbackDurationMs
  };
}

function runHitDetection(
  store: EntityStore,
  index: SpatialIndex,
  simTimeMs: number,
  maxEnemyRadius: number,
  emit: (event: RuntimeEvent) => void
): ReadonlyArray<DamageIntent> {
  const intents: DamageIntent[] = [];
  const hitProjectileIds: EntityId[] = [];

  for (const projectile of store.projectiles()) {
    const target = findFirstHit(projectile, index, maxEnemyRadius);
    if (target === null) continue;

    intents.push({
      targetId: target.id,
      amount: projectile.damage,
      source: {
        kind: 'projectile',
        projectileId: projectile.id,
        ownerKind: projectile.ownerKind,
        weaponArchetypeId: projectile.weaponArchetypeId
      },
      hitPosition: { x: projectile.position.x, y: projectile.position.y }
    });

    emit({
      kind: 'hit',
      simTime: simTimeMs,
      projectileId: projectile.id,
      targetId: target.id,
      targetKind: target.kind,
      weaponArchetypeId: projectile.weaponArchetypeId,
      damage: projectile.damage,
      x: projectile.position.x,
      y: projectile.position.y
    });

    hitProjectileIds.push(projectile.id);
  }

  for (const id of hitProjectileIds) store.removeProjectile(id);
  return intents;
}

function findFirstHit(
  projectile: Projectile,
  index: SpatialIndex,
  maxEnemyRadius: number
): Enemy | Boss | Player | null {
  const candidates = index.queryRadius(
    projectile.position.x,
    projectile.position.y,
    projectile.radius + maxEnemyRadius
  );
  for (const candidate of candidates) {
    const target = asValidTarget(candidate, projectile.ownerKind);
    if (target === null) continue;
    const dx = target.position.x - projectile.position.x;
    const dy = target.position.y - projectile.position.y;
    const reach = projectile.radius + target.radius;
    if (dx * dx + dy * dy <= reach * reach) {
      return target;
    }
  }
  return null;
}

function asValidTarget(
  entity: IndexedEntity,
  ownerKind: 'player' | 'enemy' | 'boss'
): Enemy | Boss | Player | null {
  if (ownerKind === 'player' && entity.kind === 'enemy') return entity;
  if (ownerKind === 'player' && entity.kind === 'boss') return entity;
  if (ownerKind === 'enemy' && entity.kind === 'player') return entity;
  if (ownerKind === 'boss' && entity.kind === 'player') return entity;
  return null;
}

function computeMaxProjectileTargetRadius(store: EntityStore): number {
  let max = 0;
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    if (archetype.radius > max) max = archetype.radius;
  }
  for (const boss of store.bosses()) {
    if (boss.radius > max) max = boss.radius;
  }
  return max;
}

function computeMaxContactBoundsRadius(store: EntityStore): number {
  let max = 0;
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    max = Math.max(max, contactBoundsRadius(archetype));
  }
  for (const boss of store.bosses()) {
    max = Math.max(max, contactBoundsRadius(boss));
  }
  return max;
}

function contactBoundsRadius(entity: { contactBox: { width: number; height: number } }): number {
  return Math.hypot(entity.contactBox.width / 2, entity.contactBox.height / 2);
}

function boxesOverlap(
  left: { position: Vec2; contactBox: { width: number; height: number } },
  right: { position: Vec2; contactBox: { width: number; height: number } }
): boolean {
  return (
    Math.abs(left.position.x - right.position.x) <=
      (left.contactBox.width + right.contactBox.width) / 2 &&
    Math.abs(left.position.y - right.position.y) <=
      (left.contactBox.height + right.contactBox.height) / 2
  );
}
