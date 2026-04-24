import { BOSS_ARCHETYPES } from '../shared/content/bosses';
import { ENEMY_ARCHETYPES } from '../shared/content/enemies';
import {
  WEAPON_ARCHETYPES,
  type FirePattern,
  type WeaponArchetype,
  type WeaponModifier
} from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import { assertNever } from '../shared/protocol';
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
      impactDirX: number;
      impactDirY: number;
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

export type WeaponInstance = {
  readonly archetypeId: string;
  nextFireSimMs: number;
  modifiers: WeaponModifier[];
  overdriveUntilSimMs: number | null;
};

type ShooterWeapons = {
  ownerKind: 'player' | 'enemy' | 'boss';
  weapons: WeaponInstance[];
  selectedIndex: number | null;
};

type LinearProjectileArchetype = WeaponArchetype['projectile'] & {
  motion: Readonly<{ kind: 'linear'; speed: number }>;
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
      if (
        loadout.selectedIndex !== null &&
        (loadout.selectedIndex < 0 || loadout.selectedIndex >= loadout.weapons.length)
      ) {
        throw new Error(
          `invalid selected weapon index on session start: ${loadout.selectedIndex}`
        );
      }
      const weapons = loadout.weapons.map((weaponId) => {
        const archetype = weaponRegistry[weaponId];
        if (archetype === undefined) {
          throw new Error(`unknown weapon archetype on session start: ${weaponId}`);
        }
        return createWeaponInstance(archetype.id, simTimeMs);
      });
      if (weapons.length === 0) {
        throw new Error('player loadout must contain at least one weapon');
      }
      shooterWeapons.set(playerId, {
        ownerKind: 'player',
        weapons,
        selectedIndex: loadout.selectedIndex
      });
    },
    clear(): void {
      shooterWeapons.clear();
    },
    tick(input, store, index, simTimeMs, arena, emit): ReadonlyArray<DamageIntent> {
      const maxContactBoundsRadius = computeMaxContactBoundsRadius(store);
      const maxProjectileTargetBoundsRadius = computeMaxProjectileTargetBoundsRadius(store);
      runFiringDecisions(input, store, simTimeMs, shooterWeapons, weaponRegistry, emit);
      runProjectileMovement(store);
      runLifetimeCleanup(store, simTimeMs, arena);
      index.rebuild(store);
      const contactIntents = runContactIntents(store, index, simTimeMs, maxContactBoundsRadius);
      const projectileIntents = runHitDetection(
        store,
        index,
        simTimeMs,
        maxProjectileTargetBoundsRadius,
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
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>,
  emit: (event: RuntimeEvent) => void
): void {
  const player = store.player();
  if (player === null) return;
  if (!input.firing) return;

  const weapons = shooterWeapons.get(player.id);
  if (weapons === undefined) return;
  if (input.loadout !== null) {
    weapons.selectedIndex = input.loadout.selectedIndex;
  }

  const selectedWeapon = selectedWeaponInstance(weapons);
  if (selectedWeapon === null) return;
  if (simTimeMs < selectedWeapon.nextFireSimMs) return;

  const archetype = weaponRegistry[selectedWeapon.archetypeId];
  if (archetype === undefined) return;

  const dx = input.aimWorld.x - player.position.x;
  const dy = input.aimWorld.y - player.position.y;
  const fireDirections = firePatternDirections(archetype.firePattern, dx, dy);
  if (fireDirections.length === 0) return;
  const eventDir = fireEventDirection(archetype.firePattern, dx, dy, fireDirections);
  if (eventDir === null) return;

  const spawned = spawnProjectilesForDirections(
    store,
    archetype,
    weapons.ownerKind,
    player.position,
    fireDirections,
    simTimeMs
  );
  if (spawned === 0) return;

  selectedWeapon.nextFireSimMs = simTimeMs + archetype.cooldownMs;
  emit({
    kind: 'fire',
    simTime: simTimeMs,
    shooterId: player.id,
    ownerKind: weapons.ownerKind,
    weaponArchetypeId: archetype.id,
    originX: player.position.x,
    originY: player.position.y,
    dirX: eventDir.x,
    dirY: eventDir.y
  });
}

function fireEventDirection(
  pattern: FirePattern,
  aimDx: number,
  aimDy: number,
  fireDirections: ReadonlyArray<Vec2>
): Vec2 | null {
  switch (pattern.kind) {
    case 'single':
      return normalizedVector(aimDx, aimDy);
    case 'multiDirection':
      return fireDirections[0] ?? null;
    case 'place':
      return null;
    default:
      return assertNever(pattern);
  }
}

function normalizedVector(dx: number, dy: number): Vec2 | null {
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return { x: dx / len, y: dy / len };
}

function createWeaponInstance(archetypeId: string, simTimeMs: number): WeaponInstance {
  return {
    archetypeId,
    nextFireSimMs: simTimeMs,
    modifiers: [],
    overdriveUntilSimMs: null
  };
}

function selectedWeaponInstance(weapons: ShooterWeapons): WeaponInstance | null {
  if (weapons.selectedIndex === null) return null;
  return weapons.weapons[weapons.selectedIndex] ?? null;
}

function firePatternDirections(
  pattern: FirePattern,
  aimDx: number,
  aimDy: number
): ReadonlyArray<Vec2> {
  switch (pattern.kind) {
    case 'single':
      return aimedSpreadDirections(aimDx, aimDy, pattern.count, pattern.spreadRadians);
    case 'multiDirection':
      return pattern.directions.map((angle) => ({ x: Math.cos(angle), y: Math.sin(angle) }));
    case 'place':
      return [];
    default:
      return assertNever(pattern);
  }
}

function aimedSpreadDirections(
  aimDx: number,
  aimDy: number,
  count: number,
  spreadRadians: number
): ReadonlyArray<Vec2> {
  const len = Math.hypot(aimDx, aimDy);
  if (len === 0) return [];
  const baseAngle = Math.atan2(aimDy, aimDx);
  if (count === 1) {
    return [{ x: Math.cos(baseAngle), y: Math.sin(baseAngle) }];
  }
  const start = baseAngle - spreadRadians / 2;
  const step = spreadRadians / (count - 1);
  const directions: Vec2[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = start + step * index;
    directions.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  return directions;
}

function spawnProjectilesForDirections(
  store: EntityStore,
  archetype: WeaponArchetype,
  ownerKind: 'player' | 'enemy' | 'boss',
  origin: Vec2,
  directions: ReadonlyArray<Vec2>,
  simTimeMs: number
): number {
  const projectile = legacyLinearProjectile(archetype);
  if (projectile === null) return 0;
  for (const direction of directions) {
    store.spawnProjectile({
      weaponArchetypeId: archetype.id,
      ownerKind,
      motionKind: projectile.motion.kind,
      position: origin,
      velocity: {
        vx: direction.x * projectile.motion.speed,
        vy: direction.y * projectile.motion.speed
      },
      size: projectile.size,
      hitRadius: projectile.hitRadius,
      impactDamage: projectile.impactDamage,
      knockbackImpulse: projectile.knockbackImpulse,
      pierceRemaining: projectile.pierceCount,
      groundOnImpact: projectile.groundOnImpact,
      groundedLifetimeMs: projectile.groundedLifetimeMs,
      explosion: projectile.explosion,
      groundAtSimMs: null,
      expireAtSimMs: simTimeMs + projectile.ttlMs
    });
  }
  return directions.length;
}

function legacyLinearProjectile(archetype: WeaponArchetype): LinearProjectileArchetype | null {
  const { projectile } = archetype;
  const { motion } = projectile;
  if (motion.kind !== 'linear') return null;
  return { ...projectile, motion };
}

function runProjectileMovement(store: EntityStore): void {
  for (const projectile of store.projectiles()) {
    if (projectile.motionKind !== 'linear') continue;
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
  maxProjectileTargetBoundsRadius: number,
  emit: (event: RuntimeEvent) => void
): ReadonlyArray<DamageIntent> {
  const intents: DamageIntent[] = [];
  const hitProjectileIds: EntityId[] = [];

  for (const projectile of store.projectiles()) {
    const target = findFirstHit(projectile, index, maxProjectileTargetBoundsRadius);
    if (target === null) continue;
    const impactDir = normalizedProjectileDirection(projectile);
    if (target.kind === 'enemy' || target.kind === 'boss') {
      applyProjectileKnockback(target, projectile, impactDir, simTimeMs);
    }

    intents.push({
      targetId: target.id,
      amount: projectile.impactDamage,
      source: {
        kind: 'projectile',
        projectileId: projectile.id,
        ownerKind: projectile.ownerKind,
        weaponArchetypeId: projectile.weaponArchetypeId,
        impactDirX: impactDir.x,
        impactDirY: impactDir.y
      },
      hitPosition: { x: projectile.position.x, y: projectile.position.y }
    });

    emit({
      kind: 'hit',
      simTime: simTimeMs,
      projectileId: projectile.id,
      targetId: target.id,
      targetKind: target.kind,
      targetArchetypeId: target.kind === 'player' ? null : target.archetypeId,
      weaponArchetypeId: projectile.weaponArchetypeId,
      damage: projectile.impactDamage,
      impactDirX: impactDir.x,
      impactDirY: impactDir.y,
      x: projectile.position.x,
      y: projectile.position.y
    });

    hitProjectileIds.push(projectile.id);
  }

  for (const id of hitProjectileIds) store.removeProjectile(id);
  return intents;
}

function normalizedProjectileDirection(projectile: Projectile): Vec2 {
  const len = Math.hypot(projectile.velocity.vx, projectile.velocity.vy);
  if (len === 0) return { x: 1, y: 0 };
  return { x: projectile.velocity.vx / len, y: projectile.velocity.vy / len };
}

function applyProjectileKnockback(
  target: Enemy | Boss,
  projectile: Projectile,
  impactDir: Vec2,
  simTimeMs: number
): void {
  const impulseSpeed = projectile.knockbackImpulse * target.knockbackVelocityScale;
  target.knockback = {
    vx: impulseSpeed * impactDir.x,
    vy: impulseSpeed * impactDir.y,
    startSimMs: simTimeMs,
    endSimMs: simTimeMs + target.knockbackDurationMs
  };
}

function findFirstHit(
  projectile: Projectile,
  index: SpatialIndex,
  maxProjectileTargetBoundsRadius: number
): Enemy | Boss | Player | null {
  const candidates = index.queryRadius(
    projectile.position.x,
    projectile.position.y,
    projectile.hitRadius + maxProjectileTargetBoundsRadius
  );
  for (const candidate of candidates) {
    const target = asValidTarget(candidate, projectile.ownerKind);
    if (target === null) continue;
    if (circleOverlapsBox({ position: projectile.position, radius: projectile.hitRadius }, target)) {
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

function computeMaxProjectileTargetBoundsRadius(store: EntityStore): number {
  let max = 0;
  const player = store.player();
  if (player !== null) {
    max = Math.max(max, contactBoundsRadius(player));
  }
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    max = Math.max(max, contactBoundsRadius(archetype));
  }
  for (const archetype of Object.values(BOSS_ARCHETYPES)) {
    max = Math.max(max, contactBoundsRadius(archetype));
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

function circleOverlapsBox(
  circle: { position: Vec2; radius: number },
  box: { position: Vec2; contactBox: { width: number; height: number } }
): boolean {
  const halfWidth = box.contactBox.width / 2;
  const halfHeight = box.contactBox.height / 2;
  const closestX = clamp(
    circle.position.x,
    box.position.x - halfWidth,
    box.position.x + halfWidth
  );
  const closestY = clamp(
    circle.position.y,
    box.position.y - halfHeight,
    box.position.y + halfHeight
  );
  const dx = circle.position.x - closestX;
  const dy = circle.position.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
