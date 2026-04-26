import { BOSS_ARCHETYPES } from '../shared/content/bosses';
import { ENEMY_ARCHETYPES } from '../shared/content/enemies';
import {
  WEAPON_ARCHETYPES,
  type ActorEffectApplication,
  type DetonationTrigger,
  type FirePattern,
  type FragmentSpec,
  type ProjectileArchetype,
  type WeaponArchetype,
  type WeaponModifier
} from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import { assertNever } from '../shared/protocol';
import type { ArenaConfig, DamageRules, Loadout, Vec2 } from '../shared/session';
import type { WeaponHudSnapshot } from '../shared/snapshot';
import { SIM_STEP_MS } from '../shared/timing';

import type { Boss, Enemy, EntityId, EntityStore, Player, Projectile } from './EntityStore';
import { canDamageTarget, DEFAULT_DAMAGE_RULES } from './DamageRules';
import type { ActorEffectIntent } from './FieldEffectSystem';
import type { RuntimeInputState } from './RuntimeInputState';
import type { IndexedEntity, SpatialIndex } from './SpatialIndex';

const SIM_STEP_SEC = SIM_STEP_MS / 1000;
const WEAPON_MODIFIER_MIN_SPREAD_RADIANS = 0.25;
const MAX_STACKS_PER_WEAPON_MODIFIER = 2;
export const SLIME_WEAPON_COOLDOWN_MULTIPLIER = 4;

export type DamageSource =
  | {
      kind: 'projectile';
      projectileId: EntityId;
      ownerId?: EntityId;
      ownerKind: 'player' | 'enemy' | 'boss';
      weaponArchetypeId: string;
      impactDirX: number;
      impactDirY: number;
    }
  | {
      kind: 'explosion';
      projectileId: EntityId;
      ownerId?: EntityId;
      ownerKind: 'player' | 'enemy' | 'boss';
      weaponArchetypeId: string;
    }
  | { kind: 'enemyContact'; enemyId: EntityId }
  | { kind: 'fieldEffect'; fieldEffectId: EntityId; archetypeId: string }
  | { kind: 'statusEffect'; statusKind: string; sourceEntityId: EntityId | null }
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
  overdriveCooldownMultiplier: number | null;
};

export type WeaponFireResult = Readonly<{
  spawned: number;
  eventDirection: Vec2;
}>;

type ShooterWeapons = {
  ownerKind: 'player' | 'enemy' | 'boss';
  weapons: WeaponInstance[];
  selectedIndex: number | null;
};

export type CombatSystem = Readonly<{
  setDamageRules(rules: DamageRules): void;
  setPlayerLoadout(playerId: EntityId, loadout: Loadout, simTimeMs: number): void;
  setEnemyLoadout(enemyId: EntityId, loadout: Loadout, simTimeMs: number): void;
  removeShooter(entityId: EntityId): void;
  addModifierToSelectedWeapon(ownerId: EntityId, modifier: WeaponModifier): boolean;
  applyTemporaryOverdriveToSelectedWeapon(
    ownerId: EntityId,
    cooldownMultiplier: number,
    durationMs: number,
    simTimeMs: number
  ): boolean;
  weaponHudFor(playerId: EntityId | null): WeaponHudSnapshot | null;
  drainActorEffectIntents(): ReadonlyArray<ActorEffectIntent>;
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
  let damageRules: DamageRules = DEFAULT_DAMAGE_RULES;
  let pendingActorEffectIntents: ActorEffectIntent[] = [];

  return {
    setDamageRules(rules): void {
      damageRules = { slimeFriendlyFire: rules.slimeFriendlyFire };
    },
    setPlayerLoadout(playerId, loadout, simTimeMs): void {
      shooterWeapons.set(
        playerId,
        buildShooterWeapons(loadout, 'player', weaponRegistry, simTimeMs)
      );
    },
    setEnemyLoadout(enemyId, loadout, simTimeMs): void {
      shooterWeapons.set(enemyId, buildShooterWeapons(loadout, 'enemy', weaponRegistry, simTimeMs));
    },
    removeShooter(entityId): void {
      shooterWeapons.delete(entityId);
    },
    addModifierToSelectedWeapon(ownerId, modifier): boolean {
      const weapon = selectedWeaponForOwner(shooterWeapons, ownerId);
      if (weapon === null) return false;
      if (modifierStackCount(weapon.modifiers, modifier.kind) >= MAX_STACKS_PER_WEAPON_MODIFIER) {
        return false;
      }
      weapon.modifiers.push(copyWeaponModifier(modifier));
      return true;
    },
    applyTemporaryOverdriveToSelectedWeapon(
      ownerId,
      cooldownMultiplier,
      durationMs,
      simTimeMs
    ): boolean {
      if (cooldownMultiplier <= 0) {
        throw new Error(`temporaryOverdrive cooldownMultiplier must be > 0: ${cooldownMultiplier}`);
      }
      if (durationMs <= 0) {
        throw new Error(`temporaryOverdrive durationMs must be > 0: ${durationMs}`);
      }
      const weapon = selectedWeaponForOwner(shooterWeapons, ownerId);
      if (weapon === null) return false;
      weapon.overdriveCooldownMultiplier = cooldownMultiplier;
      weapon.overdriveUntilSimMs = simTimeMs + durationMs;
      return true;
    },
    weaponHudFor(playerId): WeaponHudSnapshot | null {
      if (playerId === null) return null;
      const loadout = shooterWeapons.get(playerId);
      if (loadout === undefined) return null;
      return {
        selectedIndex: loadout.selectedIndex,
        weapons: loadout.weapons.map((weapon, index) => ({
          index,
          weaponArchetypeId: weapon.archetypeId,
          cooldownReadyAtSimMs: weapon.nextFireSimMs,
          overdriveUntilSimMs: weapon.overdriveUntilSimMs
        }))
      };
    },
    drainActorEffectIntents(): ReadonlyArray<ActorEffectIntent> {
      const drained = pendingActorEffectIntents;
      pendingActorEffectIntents = [];
      return drained;
    },
    clear(): void {
      shooterWeapons.clear();
      damageRules = DEFAULT_DAMAGE_RULES;
      pendingActorEffectIntents = [];
    },
    tick(input, store, index, simTimeMs, arena, emit): ReadonlyArray<DamageIntent> {
      pendingActorEffectIntents = [];
      const maxContactBoundsRadius = computeMaxContactBoundsRadius(store);
      const maxProjectileTargetBoundsRadius = computeMaxProjectileTargetBoundsRadius(store);
      const projectileRemovals = new Set<EntityId>();
      runPlayerFiringDecisions(input, store, simTimeMs, shooterWeapons, weaponRegistry, emit);
      runEnemyFiringDecisions(store, simTimeMs, shooterWeapons, weaponRegistry, emit);
      runProjectileMovement(store, simTimeMs, projectileRemovals);
      markLifetimeCleanup(store, simTimeMs, arena, projectileRemovals);
      index.rebuild(store);
      markProximityDetonations(
        store,
        index,
        simTimeMs,
        maxProjectileTargetBoundsRadius,
        damageRules
      );
      const contactIntents = runContactIntents(store, index, simTimeMs, maxContactBoundsRadius);
      const projectileIntents = runHitDetection(
        store,
        index,
        simTimeMs,
        maxProjectileTargetBoundsRadius,
        damageRules,
        projectileRemovals,
        emit
      );
      const explosionIntents = runGroundedDetonations(
        store,
        index,
        simTimeMs,
        maxProjectileTargetBoundsRadius,
        damageRules,
        weaponRegistry,
        projectileRemovals,
        pendingActorEffectIntents,
        emit
      );
      for (const id of projectileRemovals) store.removeProjectile(id);
      return mergeDamageIntents(contactIntents, projectileIntents, explosionIntents);
    }
  };
}

function runPlayerFiringDecisions(
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
  const result = fireWeaponProjectiles(
    store,
    archetype,
    selectedWeapon.modifiers,
    player.id,
    weapons.ownerKind,
    player.position,
    input.aimWorld,
    simTimeMs
  );
  if (result === null) return;

  selectedWeapon.nextFireSimMs =
    simTimeMs +
    effectiveCooldownMs(archetype.cooldownMs, selectedWeapon, simTimeMs, weapons.ownerKind);
  emit({
    kind: 'fire',
    simTime: simTimeMs,
    shooterId: player.id,
    ownerKind: weapons.ownerKind,
    weaponArchetypeId: archetype.id,
    originX: player.position.x,
    originY: player.position.y,
    dirX: result.eventDirection.x,
    dirY: result.eventDirection.y
  });
}

function runEnemyFiringDecisions(
  store: EntityStore,
  simTimeMs: number,
  shooterWeapons: Map<EntityId, ShooterWeapons>,
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>,
  emit: (event: RuntimeEvent) => void
): void {
  const player = store.player();
  if (player === null) return;

  for (const enemy of store.enemies()) {
    if (enemy.hp <= 0) continue;
    const weapons = shooterWeapons.get(enemy.id);
    if (weapons === undefined || weapons.ownerKind !== 'enemy') continue;
    const selectedWeapon = selectedWeaponInstance(weapons);
    if (selectedWeapon === null) continue;
    if (simTimeMs < selectedWeapon.nextFireSimMs) continue;

    const aimDx = player.position.x - enemy.position.x;
    const aimDy = player.position.y - enemy.position.y;
    if (aimDx === 0 && aimDy === 0) continue;

    const archetype = weaponRegistry[selectedWeapon.archetypeId];
    if (archetype === undefined) continue;
    const result = fireWeaponProjectiles(
      store,
      archetype,
      selectedWeapon.modifiers,
      enemy.id,
      'enemy',
      enemy.position,
      player.position,
      simTimeMs
    );
    if (result === null) continue;

    selectedWeapon.nextFireSimMs =
      simTimeMs +
      effectiveCooldownMs(archetype.cooldownMs, selectedWeapon, simTimeMs, weapons.ownerKind);
    emit({
      kind: 'fire',
      simTime: simTimeMs,
      shooterId: enemy.id,
      ownerKind: 'enemy',
      weaponArchetypeId: archetype.id,
      originX: enemy.position.x,
      originY: enemy.position.y,
      dirX: result.eventDirection.x,
      dirY: result.eventDirection.y
    });
  }
}

export function fireWeaponProjectiles(
  store: EntityStore,
  archetype: WeaponArchetype,
  modifiers: ReadonlyArray<WeaponModifier>,
  ownerId: EntityId,
  ownerKind: 'player' | 'enemy' | 'boss',
  origin: Vec2,
  aimWorld: Vec2,
  simTimeMs: number
): WeaponFireResult | null {
  const effectiveFirePattern = applyFirePatternModifiers(archetype.firePattern, modifiers);
  const effectiveProjectile = applyProjectileModifiers(archetype.projectile, modifiers);
  const dx = aimWorld.x - origin.x;
  const dy = aimWorld.y - origin.y;
  const aimDistance = Math.hypot(dx, dy);
  const fireDirections = firePatternDirections(effectiveFirePattern, dx, dy);
  if (fireDirections.length === 0) return null;
  const eventDirection = fireEventDirection(effectiveFirePattern, dx, dy, fireDirections);
  if (eventDirection === null) return null;

  const spawned = spawnProjectilesForDirections(
    store,
    archetype.id,
    effectiveProjectile,
    ownerId,
    ownerKind,
    origin,
    fireDirections,
    simTimeMs,
    aimDistance
  );
  if (spawned === 0) return null;
  return { spawned, eventDirection };
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
      return normalizedVector(aimDx, aimDy) ?? { x: 1, y: 0 };
    default:
      return assertNever(pattern);
  }
}

function normalizedVector(dx: number, dy: number): Vec2 | null {
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return { x: dx / len, y: dy / len };
}

function createWeaponInstance(
  archetype: WeaponArchetype,
  ownerKind: ShooterWeapons['ownerKind'],
  simTimeMs: number
): WeaponInstance {
  return {
    archetypeId: archetype.id,
    nextFireSimMs: simTimeMs + initialFireDelayMs(archetype.cooldownMs, ownerKind),
    modifiers: [],
    overdriveUntilSimMs: null,
    overdriveCooldownMultiplier: null
  };
}

function buildShooterWeapons(
  loadout: Loadout,
  ownerKind: 'player' | 'enemy' | 'boss',
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>,
  simTimeMs: number
): ShooterWeapons {
  if (
    loadout.selectedIndex !== null &&
    (loadout.selectedIndex < 0 || loadout.selectedIndex >= loadout.weapons.length)
  ) {
    throw new Error(
      `invalid selected weapon index for ${ownerKind} loadout: ${loadout.selectedIndex}`
    );
  }
  const weapons = loadout.weapons.map((weaponId) => {
    const archetype = weaponRegistry[weaponId];
    if (archetype === undefined) {
      throw new Error(`unknown weapon archetype for ${ownerKind} loadout: ${weaponId}`);
    }
    return createWeaponInstance(archetype, ownerKind, simTimeMs);
  });
  if (weapons.length === 0) {
    throw new Error(`${ownerKind} loadout must contain at least one weapon`);
  }
  return {
    ownerKind,
    weapons,
    selectedIndex: loadout.selectedIndex
  };
}

function selectedWeaponInstance(weapons: ShooterWeapons): WeaponInstance | null {
  if (weapons.selectedIndex === null) return null;
  return weapons.weapons[weapons.selectedIndex] ?? null;
}

function selectedWeaponForOwner(
  shooterWeapons: Map<EntityId, ShooterWeapons>,
  ownerId: EntityId
): WeaponInstance | null {
  const weapons = shooterWeapons.get(ownerId);
  if (weapons === undefined) return null;
  return selectedWeaponInstance(weapons);
}

function modifierStackCount(
  modifiers: ReadonlyArray<WeaponModifier>,
  kind: WeaponModifier['kind']
): number {
  return modifiers.filter((modifier) => modifier.kind === kind).length;
}

function copyWeaponModifier(modifier: WeaponModifier): WeaponModifier {
  switch (modifier.kind) {
    case 'projectileSizeMultiplier':
      return { kind: modifier.kind, multiplier: modifier.multiplier };
    case 'projectileSpeedMultiplier':
      return { kind: modifier.kind, multiplier: modifier.multiplier };
    case 'symmetricProjectileMultiplier':
      return { kind: modifier.kind, multiplier: modifier.multiplier };
    case 'pierceBonus':
      return { kind: modifier.kind, amount: modifier.amount };
    case 'fragmentExplosion':
      return {
        kind: modifier.kind,
        fragmentWeaponArchetypeId: modifier.fragmentWeaponArchetypeId,
        count: modifier.count,
        spreadRadians: modifier.spreadRadians
      };
    default:
      return assertNever(modifier);
  }
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
      return aimedOffsetDirections(aimDx, aimDy, pattern.directions);
    case 'place':
      return [{ x: 0, y: 0 }];
    default:
      return assertNever(pattern);
  }
}

function aimedOffsetDirections(
  aimDx: number,
  aimDy: number,
  offsetsRadians: ReadonlyArray<number>
): ReadonlyArray<Vec2> {
  const len = Math.hypot(aimDx, aimDy);
  if (len === 0) return [];
  const baseAngle = Math.atan2(aimDy, aimDx);
  return offsetsRadians.map((offset) => {
    const angle = baseAngle + offset;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
}

function applyFirePatternModifiers(
  pattern: FirePattern,
  modifiers: ReadonlyArray<WeaponModifier>
): FirePattern {
  if (pattern.kind !== 'single') return pattern;
  const countMultiplier = modifiers.reduce((acc, modifier) => {
    return modifier.kind === 'symmetricProjectileMultiplier'
      ? acc * modifier.multiplier
      : acc;
  }, 1);
  const count = Math.max(1, Math.round(pattern.count * countMultiplier));
  const spreadRadians =
    pattern.spreadRadians === 0 && count > 1
      ? WEAPON_MODIFIER_MIN_SPREAD_RADIANS
      : pattern.spreadRadians;
  return { kind: 'single', count, spreadRadians };
}

function applyProjectileModifiers(
  projectile: ProjectileArchetype,
  modifiers: ReadonlyArray<WeaponModifier>
): ProjectileArchetype {
  let sizeMultiplier = 1;
  let speedMultiplier = 1;
  let pierceBonus = 0;
  let fragmentOverride: FragmentSpec | null = null;
  for (const modifier of modifiers) {
    switch (modifier.kind) {
      case 'projectileSizeMultiplier':
        sizeMultiplier *= modifier.multiplier;
        break;
      case 'projectileSpeedMultiplier':
        speedMultiplier *= modifier.multiplier;
        break;
      case 'pierceBonus':
        pierceBonus += modifier.amount;
        break;
      case 'fragmentExplosion':
        fragmentOverride = {
          weaponArchetypeId: modifier.fragmentWeaponArchetypeId,
          count: modifier.count,
          spreadRadians: modifier.spreadRadians
        };
        break;
      case 'symmetricProjectileMultiplier':
        break;
      default:
        assertNever(modifier);
    }
  }

  return {
    ...projectile,
    motion: applySpeedModifier(projectile.motion, speedMultiplier),
    size: {
      width: projectile.size.width * sizeMultiplier,
      height: projectile.size.height * sizeMultiplier
    },
    hitRadius: projectile.hitRadius * sizeMultiplier,
    pierceCount: projectile.pierceCount + pierceBonus,
    explosion:
      projectile.explosion === null
        ? null
        : {
            ...projectile.explosion,
            fragments: fragmentOverride ?? projectile.explosion.fragments
          }
  };
}

function applySpeedModifier(
  motion: ProjectileArchetype['motion'],
  speedMultiplier: number
): ProjectileArchetype['motion'] {
  switch (motion.kind) {
    case 'linear':
      return { kind: 'linear', speed: motion.speed * speedMultiplier };
    case 'arc':
      return {
        kind: 'arc',
        speed: motion.speed * speedMultiplier,
        range: motion.range,
        flightMs: Math.max(1, Math.round(motion.flightMs / speedMultiplier))
      };
    case 'placed':
      return motion;
    default:
      return assertNever(motion);
  }
}

function effectiveCooldownMs(
  baseCooldownMs: number,
  weapon: WeaponInstance,
  simTimeMs: number,
  ownerKind: ShooterWeapons['ownerKind']
): number {
  const overdriveActive =
    weapon.overdriveCooldownMultiplier !== null &&
    weapon.overdriveUntilSimMs !== null &&
    simTimeMs < weapon.overdriveUntilSimMs;
  const multiplier =
    ownerCooldownMultiplier(ownerKind) *
    (overdriveActive ? weapon.overdriveCooldownMultiplier! : 1);
  return Math.max(1, Math.round(baseCooldownMs * multiplier));
}

function initialFireDelayMs(baseCooldownMs: number, ownerKind: ShooterWeapons['ownerKind']): number {
  if (ownerKind !== 'enemy') return 0;
  return Math.max(1, Math.round(baseCooldownMs * ownerCooldownMultiplier(ownerKind)));
}

function ownerCooldownMultiplier(ownerKind: ShooterWeapons['ownerKind']): number {
  return ownerKind === 'enemy' ? SLIME_WEAPON_COOLDOWN_MULTIPLIER : 1;
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
  weaponArchetypeId: string,
  projectile: ProjectileArchetype,
  ownerId: EntityId,
  ownerKind: 'player' | 'enemy' | 'boss',
  origin: Vec2,
  directions: ReadonlyArray<Vec2>,
  simTimeMs: number,
  aimDistance: number | null
): number {
  for (const direction of directions) {
    spawnProjectileForDirection(
      store,
      weaponArchetypeId,
      projectile,
      ownerId,
      ownerKind,
      origin,
      direction,
      simTimeMs,
      aimDistance
    );
  }
  return directions.length;
}

function spawnProjectileForDirection(
  store: EntityStore,
  weaponArchetypeId: string,
  projectile: ProjectileArchetype,
  ownerId: EntityId,
  ownerKind: 'player' | 'enemy' | 'boss',
  origin: Vec2,
  direction: Vec2,
  simTimeMs: number,
  aimDistance: number | null
): void {
  const expireAtSimMs = simTimeMs + projectile.ttlMs;
  switch (projectile.motion.kind) {
    case 'linear':
      store.spawnProjectile({
        weaponArchetypeId,
        ownerId,
        ownerKind,
        motionKind: 'linear',
        origin,
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
        detonationTrigger: projectile.detonationTrigger,
        explosion: projectile.explosion,
        groundAtSimMs: null,
        expireAtSimMs
      });
      return;
    case 'arc': {
      const travelDistance = Math.min(
        projectile.motion.range,
        aimDistance ?? projectile.motion.range
      );
      const end = {
        x: origin.x + direction.x * travelDistance,
        y: origin.y + direction.y * travelDistance
      };
      const flightMs = Math.max(1, projectile.motion.flightMs);
      store.spawnProjectile({
        weaponArchetypeId,
        ownerId,
        ownerKind,
        motionKind: 'arc',
        origin,
        arcStart: origin,
        arcEnd: end,
        arcStartSimMs: simTimeMs,
        arcEndSimMs: simTimeMs + flightMs,
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
        detonationTrigger: projectile.detonationTrigger,
        explosion: projectile.explosion,
        groundAtSimMs: null,
        expireAtSimMs
      });
      return;
    }
    case 'placed': {
      const detonateAtSimMs =
        projectile.explosion === null
          ? null
          : detonateAtSimMsForTrigger(
              projectile.detonationTrigger,
              projectile.explosion.delayMs,
              simTimeMs
            );
      store.spawnProjectile({
        weaponArchetypeId,
        ownerId,
        ownerKind,
        motionKind: 'placed',
        origin,
        position: origin,
        velocity: { vx: 0, vy: 0 },
        size: projectile.size,
        hitRadius: projectile.hitRadius,
        impactDamage: projectile.impactDamage,
        knockbackImpulse: projectile.knockbackImpulse,
        pierceRemaining: projectile.pierceCount,
        groundOnImpact: projectile.groundOnImpact,
        groundedLifetimeMs: projectile.groundedLifetimeMs,
        detonationTrigger: projectile.detonationTrigger,
        explosion: projectile.explosion,
        state: 'grounded',
        groundAtSimMs: simTimeMs,
        detonateAtSimMs,
        expireAtSimMs
      });
      return;
    }
    default:
      assertNever(projectile.motion);
  }
}

function runProjectileMovement(
  store: EntityStore,
  simTimeMs: number,
  projectileRemovals: Set<EntityId>
): void {
  for (const projectile of store.projectiles()) {
    if (projectileRemovals.has(projectile.id)) continue;
    if (projectile.state !== 'flying') continue;
    if (projectile.motionKind === 'linear') {
      projectile.position.x += projectile.velocity.vx * SIM_STEP_SEC;
      projectile.position.y += projectile.velocity.vy * SIM_STEP_SEC;
      continue;
    }
    if (projectile.motionKind === 'arc') {
      updateArcProjectilePosition(projectile, simTimeMs);
      if (projectile.arcEndSimMs !== null && simTimeMs >= projectile.arcEndSimMs) {
        if (projectile.groundOnImpact) {
          groundProjectile(projectile, simTimeMs);
        } else {
          projectileRemovals.add(projectile.id);
        }
      }
    }
  }
}

function updateArcProjectilePosition(projectile: Projectile, simTimeMs: number): void {
  if (
    projectile.arcStart === null ||
    projectile.arcEnd === null ||
    projectile.arcStartSimMs === null ||
    projectile.arcEndSimMs === null
  ) {
    return;
  }
  const durationMs = Math.max(1, projectile.arcEndSimMs - projectile.arcStartSimMs);
  const progress = clamp((simTimeMs - projectile.arcStartSimMs) / durationMs, 0, 1);
  projectile.position.x =
    projectile.arcStart.x + (projectile.arcEnd.x - projectile.arcStart.x) * progress;
  projectile.position.y =
    projectile.arcStart.y + (projectile.arcEnd.y - projectile.arcStart.y) * progress;
  const durationSec = durationMs / 1000;
  projectile.velocity.vx = (projectile.arcEnd.x - projectile.arcStart.x) / durationSec;
  projectile.velocity.vy = (projectile.arcEnd.y - projectile.arcStart.y) / durationSec;
}

function markLifetimeCleanup(
  store: EntityStore,
  simTimeMs: number,
  arena: ArenaConfig,
  projectileRemovals: Set<EntityId>
): void {
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  for (const projectile of store.projectiles()) {
    const waitingToDetonate =
      projectile.explosion !== null &&
      projectile.detonateAtSimMs !== null &&
      simTimeMs >= projectile.detonateAtSimMs;
    if (simTimeMs >= projectile.expireAtSimMs && !waitingToDetonate) {
      projectileRemovals.add(projectile.id);
      continue;
    }
    if (projectile.state === 'grounded') continue;
    const { x, y } = projectile.position;
    if (x < -halfW || x > halfW || y < -halfH || y > halfH) {
      projectileRemovals.add(projectile.id);
    }
  }
}

function markProximityDetonations(
  store: EntityStore,
  index: SpatialIndex,
  simTimeMs: number,
  maxProjectileTargetBoundsRadius: number,
  damageRules: DamageRules
): void {
  for (const projectile of store.projectiles()) {
    if (projectile.state !== 'grounded') continue;
    if (projectile.explosion === null) continue;
    const trigger = projectile.detonationTrigger;
    if (trigger === null || trigger.kind === 'timer') continue;
    if (projectile.groundAtSimMs === null) continue;
    if (simTimeMs < projectile.groundAtSimMs + trigger.armDelayMs) continue;
    if (
      projectile.detonateAtSimMs !== null &&
      simTimeMs >= projectile.detonateAtSimMs
    ) {
      continue;
    }
    if (
      hasProximityTarget(
        projectile,
        trigger.radius,
        index,
        maxProjectileTargetBoundsRadius,
        damageRules
      )
    ) {
      projectile.detonateAtSimMs = simTimeMs;
    }
  }
}

function hasProximityTarget(
  projectile: Projectile,
  radius: number,
  index: SpatialIndex,
  maxProjectileTargetBoundsRadius: number,
  damageRules: DamageRules
): boolean {
  const candidates = index.queryRadius(
    projectile.position.x,
    projectile.position.y,
    radius + maxProjectileTargetBoundsRadius
  );
  for (const candidate of candidates) {
    const target = asExplosionTarget(candidate, projectile, damageRules);
    if (target === null) continue;
    if (circleOverlapsBox({ position: projectile.position, radius }, target)) return true;
  }
  return false;
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

type DamageableTarget = Enemy | Boss | Player;

function runHitDetection(
  store: EntityStore,
  index: SpatialIndex,
  simTimeMs: number,
  maxProjectileTargetBoundsRadius: number,
  damageRules: DamageRules,
  projectileRemovals: Set<EntityId>,
  emit: (event: RuntimeEvent) => void
): ReadonlyArray<DamageIntent> {
  const intents: DamageIntent[] = [];

  for (const projectile of store.projectiles()) {
    if (projectileRemovals.has(projectile.id)) continue;
    if (!isImpactEligible(projectile, simTimeMs)) continue;
    const target = findFirstHit(projectile, index, maxProjectileTargetBoundsRadius, damageRules);
    if (target === null) continue;
    const impactDir = normalizedProjectileDirection(projectile);
    if (target.kind === 'enemy' || target.kind === 'boss') {
      applyProjectileKnockback(target, projectile, impactDir, simTimeMs);
    }

    projectile.hitEntityIds.add(target.id);
    if (projectile.impactDamage > 0) {
      intents.push({
        targetId: target.id,
        amount: projectile.impactDamage,
        source: {
          kind: 'projectile',
          projectileId: projectile.id,
          ownerId: projectile.ownerId,
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
    }

    if (projectile.groundOnImpact) {
      groundProjectile(projectile, simTimeMs);
      continue;
    }
    if (projectile.pierceRemaining > 0) {
      projectile.pierceRemaining -= 1;
      continue;
    }
    projectileRemovals.add(projectile.id);
  }

  return intents;
}

function isImpactEligible(projectile: Projectile, simTimeMs: number): boolean {
  if (projectile.state === 'flying') return true;
  return projectile.motionKind === 'arc' && projectile.groundAtSimMs === simTimeMs;
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
  maxProjectileTargetBoundsRadius: number,
  damageRules: DamageRules
): DamageableTarget | null {
  const candidates = index.queryRadius(
    projectile.position.x,
    projectile.position.y,
    projectile.hitRadius + maxProjectileTargetBoundsRadius
  );
  for (const candidate of candidates) {
    const target = asValidTarget(candidate, projectile, damageRules);
    if (target === null) continue;
    if (circleOverlapsBox({ position: projectile.position, radius: projectile.hitRadius }, target)) {
      return target;
    }
  }
  return null;
}

function asValidTarget(
  entity: IndexedEntity,
  projectile: Projectile,
  damageRules: DamageRules
): DamageableTarget | null {
  if (entity.kind !== 'player' && entity.kind !== 'enemy' && entity.kind !== 'boss') return null;
  if (projectile.hitEntityIds.has(entity.id)) return null;
  if (!canProjectileDamage(projectile, entity, damageRules)) return null;
  return entity;
}

function canProjectileDamage(
  projectile: Projectile,
  target: DamageableTarget,
  damageRules: DamageRules
): boolean {
  return canDamageTarget(
    { ownerId: projectile.ownerId, ownerKind: projectile.ownerKind },
    target,
    damageRules
  );
}

function groundProjectile(projectile: Projectile, simTimeMs: number): void {
  projectile.state = 'grounded';
  projectile.groundAtSimMs = simTimeMs;
  projectile.detonateAtSimMs =
    projectile.explosion === null
      ? null
      : detonateAtSimMsForTrigger(
          projectile.detonationTrigger,
          projectile.explosion.delayMs,
          simTimeMs
        );
  if (projectile.groundedLifetimeMs !== null) {
    projectile.expireAtSimMs = Math.min(
      projectile.expireAtSimMs,
      simTimeMs + projectile.groundedLifetimeMs
    );
  }
}

function detonateAtSimMsForTrigger(
  trigger: DetonationTrigger | null,
  delayMs: number,
  simTimeMs: number
): number | null {
  if (trigger?.kind === 'proximity') return null;
  return simTimeMs + delayMs;
}

function runGroundedDetonations(
  store: EntityStore,
  index: SpatialIndex,
  simTimeMs: number,
  maxProjectileTargetBoundsRadius: number,
  damageRules: DamageRules,
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>,
  projectileRemovals: Set<EntityId>,
  actorEffectIntents: ActorEffectIntent[],
  emit: (event: RuntimeEvent) => void
): ReadonlyArray<DamageIntent> {
  const intents: DamageIntent[] = [];
  for (const projectile of store.projectiles()) {
    if (projectileRemovals.has(projectile.id)) continue;
    if (projectile.state !== 'grounded') continue;
    if (projectile.explosion === null) continue;
    if (projectile.detonateAtSimMs === null || simTimeMs < projectile.detonateAtSimMs) continue;

    emit({
      kind: 'explosion',
      simTime: simTimeMs,
      projectileId: projectile.id,
      ownerKind: projectile.ownerKind,
      weaponArchetypeId: projectile.weaponArchetypeId,
      damage: projectile.explosion.damage,
      radius: projectile.explosion.radius,
      x: projectile.position.x,
      y: projectile.position.y
    });
    addExplosionIntents(
      projectile,
      index,
      simTimeMs,
      maxProjectileTargetBoundsRadius,
      damageRules,
      intents,
      actorEffectIntents
    );
    spawnExplosionFieldEffect(store, projectile, simTimeMs);
    spawnExplosionFragments(store, projectile, weaponRegistry, simTimeMs);
    projectileRemovals.add(projectile.id);
  }
  return intents;
}

function addExplosionIntents(
  projectile: Projectile,
  index: SpatialIndex,
  simTimeMs: number,
  maxProjectileTargetBoundsRadius: number,
  damageRules: DamageRules,
  intents: DamageIntent[],
  actorEffectIntents: ActorEffectIntent[]
): void {
  const explosion = projectile.explosion;
  if (explosion === null || explosion.radius <= 0) return;
  const candidates = index.queryRadius(
    projectile.position.x,
    projectile.position.y,
    explosion.radius + maxProjectileTargetBoundsRadius
  );
  for (const candidate of candidates) {
    const target = asExplosionTarget(candidate, projectile, damageRules);
    if (target === null) continue;
    if (!circleOverlapsBox({ position: projectile.position, radius: explosion.radius }, target)) {
      continue;
    }
    if (target.kind === 'enemy' || target.kind === 'boss') {
      applyExplosionKnockback(target, projectile, simTimeMs);
    }
    addExplosionActorEffects(projectile, target, actorEffectIntents);
    if (explosion.damage <= 0) continue;
    intents.push({
      targetId: target.id,
      amount: explosion.damage,
      source: {
        kind: 'explosion',
        projectileId: projectile.id,
        ownerId: projectile.ownerId,
        ownerKind: projectile.ownerKind,
        weaponArchetypeId: projectile.weaponArchetypeId
      },
      hitPosition: { x: projectile.position.x, y: projectile.position.y }
    });
  }
}

function addExplosionActorEffects(
  projectile: Projectile,
  target: DamageableTarget,
  actorEffectIntents: ActorEffectIntent[]
): void {
  const effects = projectile.explosion?.effects ?? [];
  for (const effect of effects) {
    applyExplosionActorEffect(projectile, target, effect, actorEffectIntents);
  }
}

function applyExplosionActorEffect(
  projectile: Projectile,
  target: DamageableTarget,
  effect: ActorEffectApplication,
  actorEffectIntents: ActorEffectIntent[]
): void {
  switch (effect.kind) {
    case 'damage':
      return;
    case 'status':
      actorEffectIntents.push({
        targetId: target.id,
        source: {
          kind: 'explosion',
          projectileId: projectile.id,
          weaponArchetypeId: projectile.weaponArchetypeId
        },
        application: effect
      });
      return;
    default:
      assertNever(effect);
  }
}

function asExplosionTarget(
  entity: IndexedEntity,
  projectile: Projectile,
  damageRules: DamageRules
): DamageableTarget | null {
  if (entity.kind !== 'player' && entity.kind !== 'enemy' && entity.kind !== 'boss') return null;
  if (!canProjectileDamage(projectile, entity, damageRules)) return null;
  return entity;
}

function applyExplosionKnockback(
  target: Enemy | Boss,
  projectile: Projectile,
  simTimeMs: number
): void {
  const explosion = projectile.explosion;
  if (explosion === null) return;
  const direction = normalizedExplosionDirection(projectile, target);
  const impulseSpeed = explosion.knockbackImpulse * target.knockbackVelocityScale;
  target.knockback = {
    vx: impulseSpeed * direction.x,
    vy: impulseSpeed * direction.y,
    startSimMs: simTimeMs,
    endSimMs: simTimeMs + target.knockbackDurationMs
  };
}

function spawnExplosionFieldEffect(
  store: EntityStore,
  projectile: Projectile,
  simTimeMs: number
): void {
  const fieldEffect = projectile.explosion?.fieldEffect ?? null;
  if (fieldEffect === null) return;
  store.spawnFieldEffect({
    archetypeId: fieldEffect.archetypeId,
    ownerId: projectile.ownerId,
    ownerKind: projectile.ownerKind,
    position: projectile.position,
    radius: fieldEffect.radius,
    applyEveryMs: fieldEffect.applyEveryMs,
    nextApplySimMs: simTimeMs,
    expireAtSimMs: simTimeMs + fieldEffect.durationMs,
    effects: fieldEffect.effects
  });
}

function normalizedExplosionDirection(projectile: Projectile, target: Enemy | Boss): Vec2 {
  const dx = target.position.x - projectile.position.x;
  const dy = target.position.y - projectile.position.y;
  const len = Math.hypot(dx, dy);
  if (len > 0) return { x: dx / len, y: dy / len };
  return normalizedProjectileDirection(projectile);
}

function spawnExplosionFragments(
  store: EntityStore,
  projectile: Projectile,
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>,
  simTimeMs: number
): void {
  const fragment = projectile.explosion?.fragments ?? null;
  if (fragment === null) return;
  const archetype = weaponRegistry[fragment.weaponArchetypeId];
  if (archetype === undefined) return;
  const directions = fragmentDirections(fragment);
  spawnProjectilesForDirections(
    store,
    archetype.id,
    archetype.projectile,
    projectile.ownerId,
    projectile.ownerKind,
    projectile.position,
    directions,
    simTimeMs,
    null
  );
}

function fragmentDirections(fragment: FragmentSpec): ReadonlyArray<Vec2> {
  if (fragment.count <= 0) return [];
  if (fragment.count === 1) return [{ x: 1, y: 0 }];
  const start = -fragment.spreadRadians / 2;
  const step = fragment.spreadRadians / fragment.count;
  const directions: Vec2[] = [];
  for (let index = 0; index < fragment.count; index += 1) {
    const angle = start + step * (index + 0.5);
    directions.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  return directions;
}

function mergeDamageIntents(
  contactIntents: ReadonlyArray<DamageIntent>,
  projectileIntents: ReadonlyArray<DamageIntent>,
  explosionIntents: ReadonlyArray<DamageIntent>
): ReadonlyArray<DamageIntent> {
  if (contactIntents.length === 0 && projectileIntents.length === 0) return explosionIntents;
  if (contactIntents.length === 0 && explosionIntents.length === 0) return projectileIntents;
  if (projectileIntents.length === 0 && explosionIntents.length === 0) return contactIntents;
  return [...contactIntents, ...projectileIntents, ...explosionIntents];
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
