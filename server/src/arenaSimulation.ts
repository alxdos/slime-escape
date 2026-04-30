import { SIM_STEP_MS } from '../../src/shared/timing.js';
import * as GENERATED_BOSSES from '../../src/shared/content/bosses.generated.js';
import { ENEMY_ARCHETYPE_LIST } from '../../src/shared/content/enemies.generated.js';
import * as GENERATED_WEAPONS from '../../src/shared/content/weapons.generated.js';
import { PUBLIC_ARENA_PLAYER } from '../../src/shared/content/publicArena.js';
export {
  PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_BOSS_LEVEL,
  PUBLIC_ARENA_BOSS_WEAPON_ID,
  PUBLIC_ARENA_REGULAR_FORM_STATS,
  PUBLIC_ARENA_REGULAR_WEAPON_ID,
  PUBLIC_ARENA_SLIME_FORM_CHAIN
} from '../../src/shared/publicArenaProgression.js';
import {
  PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_BOSS_LEVEL,
  PUBLIC_ARENA_BOSS_WEAPON_ID,
  PUBLIC_ARENA_REGULAR_FORM_STATS,
  PUBLIC_ARENA_REGULAR_WEAPON_ID,
  PUBLIC_ARENA_SLIME_FORM_CHAIN
} from '../../src/shared/publicArenaProgression.js';
import type {
  PublicArenaInputIntent,
  PublicArenaPlayerFormSnapshot,
  PublicArenaPlayerId,
  PublicArenaPlayerSnapshot,
  PublicArenaPresentationEvent,
  PublicArenaProjectileId,
  PublicArenaProjectileSnapshot,
  PublicArenaSnapshot
} from '../../src/shared/publicArenaProtocol.js';

import {
  PUBLIC_ARENA_WORLD_BOUNDS,
  type PublicArenaMember,
  type PublicArenaSpawnPoint
} from './arenaState.js';

export const PUBLIC_ARENA_INTEREST_WIDTH_WU = PUBLIC_ARENA_WORLD_BOUNDS.width;
export const PUBLIC_ARENA_INTEREST_HEIGHT_WU = 26;
export const PUBLIC_ARENA_SPAWN_PROTECTION_MS = 900;

type Vector = Readonly<{ x: number; y: number }>;
type GeneratedWeaponArchetype =
  (typeof GENERATED_WEAPONS)[keyof typeof GENERATED_WEAPONS];
type GeneratedBossArchetype = (typeof GENERATED_BOSSES)[keyof typeof GENERATED_BOSSES];
type GeneratedEnemyArchetype = (typeof ENEMY_ARCHETYPE_LIST)[number];
type FirePattern =
  | Readonly<{ kind: 'single'; spreadRadians: number; count: number }>
  | Readonly<{ kind: 'multiDirection'; directions: ReadonlyArray<number> }>
  | Readonly<{ kind: 'place' }>;
type ProjectileMotion =
  | Readonly<{ kind: 'linear'; speed: number }>
  | Readonly<{ kind: 'arc'; speed: number; range: number; flightMs: number }>
  | Readonly<{ kind: 'placed' }>;
type DetonationTrigger =
  | Readonly<{ kind: 'timer' }>
  | Readonly<{ kind: 'proximity'; radius: number; armDelayMs: number }>
  | Readonly<{ kind: 'timerOrProximity'; radius: number; armDelayMs: number }>
  | null;
type FragmentConfig = Readonly<{
  weaponArchetypeId: string;
  count: number;
  spreadRadians: number;
}>;
type ExplosionConfig = Readonly<{
  delayMs: number;
  radius: number;
  damage: number;
  knockbackImpulse: number;
  fragments: FragmentConfig | null;
  fieldEffect: unknown;
  effects: ReadonlyArray<unknown>;
}> | null;
type ProjectileConfig = Readonly<{
  motion: ProjectileMotion;
  size: Readonly<{ width: number; height: number }>;
  hitRadius: number;
  impactDamage: number;
  knockbackImpulse: number;
  pierceCount: number;
  ttlMs: number;
  groundOnImpact: boolean;
  groundedLifetimeMs: number | null;
  detonationTrigger: DetonationTrigger;
  explosion: ExplosionConfig;
}>;
type PublicArenaProjectileOwnerKind = PublicArenaProjectileSnapshot['ownerKind'];

type InterestRect = Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

type ActorStats = Readonly<{
  form: PublicArenaPlayerFormSnapshot;
  radius: number;
  maxHp: number;
  maxSpeed: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
}>;

type WeaponConfig = Readonly<{
  weaponArchetypeId: string;
  cooldownMs: number;
  firePattern: FirePattern;
  projectile: ProjectileConfig;
}>;

type RuntimePlayer = {
  id: PublicArenaPlayerId;
  socketId: string;
  spawn: PublicArenaSpawnPoint;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  maxSpeed: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  knockbackVx: number;
  knockbackVy: number;
  knockbackUntilSimMs: number;
  level: number;
  form: PublicArenaPlayerFormSnapshot;
  moveDir: Vector;
  aim: Vector;
  firing: boolean;
  nextFireAtSimMs: number;
  spawnProtectionUntilSimMs: number;
};

type RuntimeProjectile = {
  id: PublicArenaProjectileId;
  ownerId: PublicArenaPlayerId;
  ownerKind: PublicArenaProjectileOwnerKind;
  weaponArchetypeId: string;
  motionKind: 'linear' | 'arc' | 'placed';
  state: 'flying' | 'grounded';
  originX: number;
  originY: number;
  arcStart: Vector | null;
  arcEnd: Vector | null;
  arcStartSimMs: number | null;
  arcEndSimMs: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: Readonly<{ width: number; height: number }>;
  hitRadius: number;
  damage: number;
  knockbackImpulse: number;
  pierceRemaining: number;
  hitPlayerIds: Set<PublicArenaPlayerId>;
  groundOnImpact: boolean;
  groundedLifetimeMs: number | null;
  detonationTrigger: DetonationTrigger;
  explosion: ExplosionConfig;
  detonateAtSimMs: number | null;
  groundAtSimMs: number | null;
  expiresAtSimMs: number;
  angleRadians: number;
};

export type PublicArenaSimulationInit = Readonly<{
  regularWeaponId?: string;
  bossWeaponId?: string;
}>;

export type PublicArenaSimulation = Readonly<{
  simTimeMs(): number;
  addPlayer(member: PublicArenaMember): void;
  removePlayer(playerId: PublicArenaPlayerId): void;
  applyInput(playerId: PublicArenaPlayerId, intent: PublicArenaInputIntent): void;
  tick(): void;
  snapshotFor(selfId: PublicArenaPlayerId): PublicArenaSnapshot | null;
  interestSnapshotFor(selfId: PublicArenaPlayerId): PublicArenaSnapshot | null;
  drainEvents(): ReadonlyArray<PublicArenaPresentationEvent>;
}>;

const REGULAR_FORMS: ReadonlyArray<ActorStats> = PUBLIC_ARENA_REGULAR_FORM_STATS.map(
  (form) => regularForm(form.archetypeId, form.radius, form.maxHp, form.maxSpeed)
);

const BOSS_ARCHETYPE = requireBossArchetype(PUBLIC_ARENA_BOSS_ARCHETYPE_ID);
const BOSS_STATS: ActorStats = {
  form: { kind: 'boss', archetypeId: PUBLIC_ARENA_BOSS_ARCHETYPE_ID },
  radius: BOSS_ARCHETYPE.radius,
  maxHp: BOSS_ARCHETYPE.maxHp,
  maxSpeed: BOSS_ARCHETYPE.maxSpeed,
  knockbackVelocityScale: BOSS_ARCHETYPE.knockbackVelocityScale,
  knockbackDurationMs: BOSS_ARCHETYPE.knockbackDurationMs
};

export function createPublicArenaSimulation(
  init: PublicArenaSimulationInit = {}
): PublicArenaSimulation {
  const regularWeapon = weaponConfigFromArchetype(
    init.regularWeaponId ?? PUBLIC_ARENA_REGULAR_WEAPON_ID
  );
  const bossWeapon = weaponConfigFromArchetype(
    init.bossWeaponId ?? PUBLIC_ARENA_BOSS_WEAPON_ID
  );
  const players = new Map<PublicArenaPlayerId, RuntimePlayer>();
  const projectiles = new Map<PublicArenaProjectileId, RuntimeProjectile>();
  const events: PublicArenaPresentationEvent[] = [];
  let simTimeMs = 0;
  let nextProjectileSeq = 1;

  function addPlayer(member: PublicArenaMember): void {
    if (players.has(member.playerId)) {
      return;
    }

    const stats = statsForLevel(1);
    const player: RuntimePlayer = {
      id: member.playerId,
      socketId: member.socketId,
      spawn: member.spawn,
      x: member.spawn.x,
      y: member.spawn.y,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      radius: stats.radius,
      maxSpeed: stats.maxSpeed,
      knockbackVelocityScale: stats.knockbackVelocityScale,
      knockbackDurationMs: stats.knockbackDurationMs,
      knockbackVx: 0,
      knockbackVy: 0,
      knockbackUntilSimMs: 0,
      level: 1,
      form: stats.form,
      moveDir: { x: 0, y: 0 },
      aim: { x: member.spawn.x + 1, y: member.spawn.y },
      firing: false,
      nextFireAtSimMs: 0,
      spawnProtectionUntilSimMs: simTimeMs + PUBLIC_ARENA_SPAWN_PROTECTION_MS
    };
    players.set(player.id, player);
    events.push(spawnEvent(player, simTimeMs));
  }

  function removePlayer(playerId: PublicArenaPlayerId): void {
    players.delete(playerId);
    for (const projectile of projectiles.values()) {
      if (projectile.ownerId === playerId) {
        projectiles.delete(projectile.id);
      }
    }
  }

  function applyInput(playerId: PublicArenaPlayerId, intent: PublicArenaInputIntent): void {
    const player = players.get(playerId);
    if (player === undefined) {
      return;
    }

    switch (intent.kind) {
      case 'move':
        player.moveDir = normalize({ x: intent.dx, y: intent.dy });
        return;
      case 'aim':
        player.aim = {
          x: clampFinite(intent.x, PUBLIC_ARENA_WORLD_BOUNDS.minX, PUBLIC_ARENA_WORLD_BOUNDS.maxX, player.aim.x),
          y: clampFinite(intent.y, PUBLIC_ARENA_WORLD_BOUNDS.minY, PUBLIC_ARENA_WORLD_BOUNDS.maxY, player.aim.y)
        };
        return;
      case 'fire':
        player.firing = intent.phase === 'start';
        return;
      default:
        return assertNever(intent);
    }
  }

  function tick(): void {
    simTimeMs += SIM_STEP_MS;
    movePlayers();
    fireWeapons();
    moveProjectiles();
    resolveProjectileHits();
    markProximityDetonations();
    resolveProjectileExplosions();
    removeExpiredProjectiles();
  }

  function movePlayers(): void {
    const stepSeconds = SIM_STEP_MS / 1000;
    for (const player of players.values()) {
      const knockback = activeKnockback(player, simTimeMs);
      if (player.moveDir.x === 0 && player.moveDir.y === 0 && knockback.x === 0 && knockback.y === 0) {
        continue;
      }
      player.x += (player.moveDir.x * player.maxSpeed + knockback.x) * stepSeconds;
      player.y += (player.moveDir.y * player.maxSpeed + knockback.y) * stepSeconds;
      clampPlayerPosition(player);
    }
  }

  function fireWeapons(): void {
    for (const player of players.values()) {
      if (!player.firing || simTimeMs < player.nextFireAtSimMs) {
        continue;
      }

      const weapon = player.form.kind === 'boss' ? bossWeapon : regularWeapon;
      const directions = fireDirections(player, weapon);
      if (directions.length === 0) {
        continue;
      }
      for (const direction of directions) {
        spawnProjectile(player, weapon, direction);
      }
      const eventDirection = fireEventDirection(player, weapon, directions);
      events.push({
        kind: 'fire',
        simTimeMs,
        shooterId: player.id,
        ownerKind: projectileOwnerKindForPlayer(player),
        weaponArchetypeId: weapon.weaponArchetypeId,
        originX: player.x,
        originY: player.y,
        dirX: eventDirection.x,
        dirY: eventDirection.y
      });
      player.nextFireAtSimMs = simTimeMs + weapon.cooldownMs;
    }
  }

  function spawnProjectile(player: RuntimePlayer, weapon: WeaponConfig, direction: Vector): void {
    const normalized = normalizeWithFallback(direction, { x: 1, y: 0 });
    const baseProjectile = {
      id: `projectile-${nextProjectileSeq}`,
      ownerId: player.id,
      ownerKind: projectileOwnerKindForPlayer(player),
      weaponArchetypeId: weapon.weaponArchetypeId,
      originX: player.x,
      originY: player.y,
      arcStart: null,
      arcEnd: null,
      arcStartSimMs: null,
      arcEndSimMs: null,
      x: player.x,
      y: player.y,
      size: weapon.projectile.size,
      hitRadius: weapon.projectile.hitRadius,
      damage: weapon.projectile.impactDamage,
      knockbackImpulse: weapon.projectile.knockbackImpulse,
      pierceRemaining: weapon.projectile.pierceCount,
      hitPlayerIds: new Set<PublicArenaPlayerId>(),
      groundOnImpact: weapon.projectile.groundOnImpact,
      groundedLifetimeMs: weapon.projectile.groundedLifetimeMs,
      detonationTrigger: weapon.projectile.detonationTrigger,
      explosion: weapon.projectile.explosion,
      detonateAtSimMs: null,
      groundAtSimMs: null,
      expiresAtSimMs: simTimeMs + weapon.projectile.ttlMs,
      angleRadians: Math.atan2(normalized.y, normalized.x)
    };
    let projectile: RuntimeProjectile;
    switch (weapon.projectile.motion.kind) {
      case 'linear':
        projectile = {
          ...baseProjectile,
          motionKind: 'linear',
          state: 'flying',
          vx: normalized.x * weapon.projectile.motion.speed,
          vy: normalized.y * weapon.projectile.motion.speed
        };
        break;
      case 'arc':
        projectile = {
          ...baseProjectile,
          ...arcProjectileMotion(player, normalized, weapon.projectile.motion, simTimeMs)
        };
        break;
      case 'placed':
        projectile = {
          ...baseProjectile,
          motionKind: 'placed',
          state: 'grounded',
          vx: 0,
          vy: 0,
          groundAtSimMs: simTimeMs,
          detonateAtSimMs: detonateAtSimMsForTrigger(
            weapon.projectile.detonationTrigger,
            weapon.projectile.explosion?.delayMs ?? 0,
            simTimeMs
          )
        };
        break;
      default:
        assertNever(weapon.projectile.motion);
    }
    nextProjectileSeq += 1;
    projectiles.set(projectile.id, projectile);
  }

  function moveProjectiles(): void {
    const stepSeconds = SIM_STEP_MS / 1000;
    for (const projectile of projectiles.values()) {
      if (projectile.state !== 'flying') {
        continue;
      }
      if (projectile.motionKind === 'linear') {
        projectile.x += projectile.vx * stepSeconds;
        projectile.y += projectile.vy * stepSeconds;
        continue;
      }
      updateArcProjectilePosition(projectile, simTimeMs);
      if (projectile.arcEndSimMs !== null && simTimeMs >= projectile.arcEndSimMs) {
        if (projectile.groundOnImpact) {
          groundProjectile(projectile, simTimeMs);
        } else {
          projectiles.delete(projectile.id);
        }
      }
    }
  }

  function resolveProjectileHits(): void {
    const defeatedThisTick = new Set<PublicArenaPlayerId>();

    for (const projectile of [...projectiles.values()]) {
      if (!isImpactEligible(projectile, simTimeMs)) {
        continue;
      }
      const target = projectileTarget(projectile, defeatedThisTick);
      if (target === null) {
        continue;
      }

      events.push({
        kind: 'hit',
        simTimeMs,
        projectileId: projectile.id,
        ownerId: projectile.ownerId,
        ownerKind: projectile.ownerKind,
        targetId: target.id,
        targetForm: target.form,
        weaponArchetypeId: projectile.weaponArchetypeId,
        damage: projectile.damage,
        x: projectile.x,
        y: projectile.y,
        impactDirX: normalizeWithFallback({ x: projectile.vx, y: projectile.vy }, { x: 1, y: 0 }).x,
        impactDirY: normalizeWithFallback({ x: projectile.vx, y: projectile.vy }, { x: 1, y: 0 }).y
      });

      applyProjectileKnockback(projectile, target, simTimeMs);
      target.hp = Math.max(0, target.hp - projectile.damage);
      projectile.hitPlayerIds.add(target.id);
      if (projectile.groundOnImpact) {
        groundProjectile(projectile, simTimeMs);
      } else if (projectile.pierceRemaining > 0) {
        projectile.pierceRemaining -= 1;
      } else {
        projectiles.delete(projectile.id);
      }
      if (target.hp === 0) {
        defeatedThisTick.add(target.id);
        killPlayer(target, projectile.ownerId, projectile.weaponArchetypeId);
      }
    }
  }

  function projectileTarget(
    projectile: RuntimeProjectile,
    defeatedThisTick: ReadonlySet<PublicArenaPlayerId>
  ): RuntimePlayer | null {
    let nearest: RuntimePlayer | null = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;

    for (const player of players.values()) {
      if (
        player.id === projectile.ownerId ||
        projectile.hitPlayerIds.has(player.id) ||
        defeatedThisTick.has(player.id) ||
        isSpawnProtected(player)
      ) {
        continue;
      }
      const reach = projectile.hitRadius + player.radius;
      const candidateDistanceSquared = distanceSquared(projectile, player);
      if (candidateDistanceSquared > reach * reach) {
        continue;
      }
      if (
        nearest === null ||
        candidateDistanceSquared < nearestDistanceSquared ||
        (candidateDistanceSquared === nearestDistanceSquared && player.id < nearest.id)
      ) {
        nearest = player;
        nearestDistanceSquared = candidateDistanceSquared;
      }
    }
    return nearest;
  }

  function markProximityDetonations(): void {
    for (const projectile of projectiles.values()) {
      if (projectile.state !== 'grounded' || projectile.explosion === null) {
        continue;
      }
      const trigger = projectile.detonationTrigger;
      if (trigger === null || trigger.kind === 'timer' || projectile.groundAtSimMs === null) {
        continue;
      }
      if (simTimeMs < projectile.groundAtSimMs + trigger.armDelayMs) {
        continue;
      }
      if (projectile.detonateAtSimMs !== null && simTimeMs >= projectile.detonateAtSimMs) {
        continue;
      }
      if (hasProximityTarget(projectile, trigger.radius)) {
        projectile.detonateAtSimMs = simTimeMs;
      }
    }
  }

  function hasProximityTarget(projectile: RuntimeProjectile, radius: number): boolean {
    for (const player of players.values()) {
      if (player.id === projectile.ownerId || isSpawnProtected(player)) {
        continue;
      }
      const reach = radius + player.radius;
      if (distanceSquared(projectile, player) <= reach * reach) {
        return true;
      }
    }
    return false;
  }

  function resolveProjectileExplosions(): void {
    const defeatedThisTick = new Set<PublicArenaPlayerId>();

    for (const projectile of [...projectiles.values()]) {
      const explosion = projectile.explosion;
      if (
        projectile.state !== 'grounded' ||
        explosion === null ||
        projectile.detonateAtSimMs === null ||
        simTimeMs < projectile.detonateAtSimMs
      ) {
        continue;
      }

      events.push({
        kind: 'explosion',
        simTimeMs,
        projectileId: projectile.id,
        ownerId: projectile.ownerId,
        ownerKind: projectile.ownerKind,
        weaponArchetypeId: projectile.weaponArchetypeId,
        damage: explosion.damage,
        radius: explosion.radius,
        x: projectile.x,
        y: projectile.y
      });

      for (const target of explosionTargets(projectile, explosion.radius, defeatedThisTick)) {
        applyExplosionDamage(projectile, target, explosion.damage, defeatedThisTick);
      }

      spawnExplosionFragments(projectile);
      projectiles.delete(projectile.id);
    }
  }

  function explosionTargets(
    projectile: RuntimeProjectile,
    radius: number,
    defeatedThisTick: ReadonlySet<PublicArenaPlayerId>
  ): RuntimePlayer[] {
    return [...players.values()]
      .filter((player) => {
        if (
          player.id === projectile.ownerId ||
          defeatedThisTick.has(player.id) ||
          isSpawnProtected(player)
        ) {
          return false;
        }
        const reach = radius + player.radius;
        return distanceSquared(projectile, player) <= reach * reach;
      })
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  function applyExplosionDamage(
    projectile: RuntimeProjectile,
    target: RuntimePlayer,
    damage: number,
    defeatedThisTick: Set<PublicArenaPlayerId>
  ): void {
    const direction = normalizedExplosionDirection(projectile, target);
    events.push({
      kind: 'hit',
      simTimeMs,
      projectileId: projectile.id,
      ownerId: projectile.ownerId,
      ownerKind: projectile.ownerKind,
      targetId: target.id,
      targetForm: target.form,
      weaponArchetypeId: projectile.weaponArchetypeId,
      damage,
      x: projectile.x,
      y: projectile.y,
      impactDirX: direction.x,
      impactDirY: direction.y
    });
    applyKnockback(target, direction, projectile.explosion?.knockbackImpulse ?? 0, simTimeMs);
    target.hp = Math.max(0, target.hp - damage);
    if (target.hp === 0) {
      defeatedThisTick.add(target.id);
      killPlayer(target, projectile.ownerId, projectile.weaponArchetypeId);
    }
  }

  function spawnExplosionFragments(projectile: RuntimeProjectile): void {
    const fragment = projectile.explosion?.fragments ?? null;
    if (fragment === null) {
      return;
    }
    const weapon = weaponConfigFromArchetype(fragment.weaponArchetypeId);
    for (const direction of fragmentDirections(fragment.count, fragment.spreadRadians)) {
      spawnProjectileAt(projectile, weapon, direction);
    }
  }

  function spawnProjectileAt(
    source: RuntimeProjectile,
    weapon: WeaponConfig,
    direction: Vector
  ): void {
    const owner = players.get(source.ownerId);
    if (owner === undefined) {
      return;
    }
    const originalX = owner.x;
    const originalY = owner.y;
    owner.x = source.x;
    owner.y = source.y;
    spawnProjectile(owner, weapon, direction);
    owner.x = originalX;
    owner.y = originalY;
  }

  function killPlayer(victim: RuntimePlayer, killerId: PublicArenaPlayerId, weaponArchetypeId: string): void {
    events.push({
      kind: 'death',
      simTimeMs,
      playerId: victim.id,
      killerId,
      form: victim.form,
      weaponArchetypeId,
      x: victim.x,
      y: victim.y
    });

    const killer = players.get(killerId);
    resetPlayerAfterDeath(victim);

    if (killer !== undefined && killer.id !== victim.id) {
      killer.level += 1;
      applyStatsForCurrentLevel(killer, true);
      events.push({
        kind: 'levelUp',
        simTimeMs,
        playerId: killer.id,
        level: killer.level,
        form: killer.form
      });
    }
  }

  function resetPlayerAfterDeath(player: RuntimePlayer): void {
    player.level = 1;
    player.x = player.spawn.x;
    player.y = player.spawn.y;
    player.moveDir = { x: 0, y: 0 };
    clearKnockback(player);
    player.aim = { x: player.spawn.x + 1, y: player.spawn.y };
    player.firing = false;
    player.spawnProtectionUntilSimMs = simTimeMs + PUBLIC_ARENA_SPAWN_PROTECTION_MS;
    applyStatsForCurrentLevel(player, true);
    events.push(spawnEvent(player, simTimeMs));
  }

  function removeExpiredProjectiles(): void {
    for (const projectile of projectiles.values()) {
      if (
        projectile.expiresAtSimMs <= simTimeMs ||
        (projectile.state === 'flying' && isOutsideArena(projectile))
      ) {
        projectiles.delete(projectile.id);
      }
    }
  }

  function snapshotFor(selfId: PublicArenaPlayerId): PublicArenaSnapshot | null {
    if (!players.has(selfId)) {
      return null;
    }

    return {
      simTimeMs,
      selfId,
      arena: PUBLIC_ARENA_WORLD_BOUNDS,
      population: players.size,
      players: [...players.values()].map(toPlayerSnapshot),
      projectiles: [...projectiles.values()].map((projectile) =>
        toProjectileSnapshot(projectile, simTimeMs)
      )
    };
  }

  function interestSnapshotFor(selfId: PublicArenaPlayerId): PublicArenaSnapshot | null {
    const self = players.get(selfId);
    if (self === undefined) {
      return null;
    }

    const rect = interestRectFor(self);
    return {
      simTimeMs,
      selfId,
      arena: PUBLIC_ARENA_WORLD_BOUNDS,
      population: players.size,
      players: [...players.values()]
        .filter((player) => playerIntersectsInterest(player, rect))
        .map(toPlayerSnapshot),
      projectiles: [...projectiles.values()]
        .filter((projectile) => projectileIntersectsInterest(projectile, rect))
        .map((projectile) => toProjectileSnapshot(projectile, simTimeMs))
    };
  }

  function drainEvents(): ReadonlyArray<PublicArenaPresentationEvent> {
    const drained = [...events];
    events.length = 0;
    return drained;
  }

  function isSpawnProtected(player: RuntimePlayer): boolean {
    return simTimeMs < player.spawnProtectionUntilSimMs;
  }

  return {
    simTimeMs() {
      return simTimeMs;
    },
    addPlayer,
    removePlayer,
    applyInput,
    tick,
    snapshotFor,
    interestSnapshotFor,
    drainEvents
  };
}

function regularForm(archetypeId: string, radius: number, maxHp: number, maxSpeed: number): ActorStats {
  const archetype = requireEnemyArchetype(archetypeId);
  return {
    form: { kind: 'slime', archetypeId },
    radius,
    maxHp,
    maxSpeed,
    knockbackVelocityScale: archetype.knockbackVelocityScale,
    knockbackDurationMs: archetype.knockbackDurationMs
  };
}

function requireEnemyArchetype(archetypeId: string): GeneratedEnemyArchetype {
  const archetype = ENEMY_ARCHETYPE_LIST.find(
    (candidate) => candidate.id === archetypeId
  );
  if (archetype === undefined) {
    throw new Error(`Public Arena enemy archetype "${archetypeId}" is not generated.`);
  }
  return archetype;
}

function statsForLevel(level: number): ActorStats {
  if (level >= PUBLIC_ARENA_BOSS_LEVEL) {
    return BOSS_STATS;
  }

  const stats = REGULAR_FORMS[level - 1];
  if (stats === undefined) {
    throw new Error(`public arena missing regular form stats for level ${level}`);
  }
  return stats;
}

function fireDirections(player: RuntimePlayer, weapon: WeaponConfig): ReadonlyArray<Vector> {
  const aimDx = player.aim.x - player.x;
  const aimDy = player.aim.y - player.y;
  switch (weapon.firePattern.kind) {
    case 'single':
      return aimedSpreadDirections(
        aimDx,
        aimDy,
        weapon.firePattern.count,
        weapon.firePattern.spreadRadians
      );
    case 'multiDirection':
      return aimedOffsetDirections(aimDx, aimDy, weapon.firePattern.directions);
    case 'place':
      return [{ x: 0, y: 0 }];
    default:
      return assertNever(weapon.firePattern);
  }
}

function fireEventDirection(
  player: RuntimePlayer,
  weapon: WeaponConfig,
  directions: ReadonlyArray<Vector>
): Vector {
  const aimDx = player.aim.x - player.x;
  const aimDy = player.aim.y - player.y;
  switch (weapon.firePattern.kind) {
    case 'single':
      return normalizeWithFallback({ x: aimDx, y: aimDy }, { x: 1, y: 0 });
    case 'multiDirection':
      return directions[0] ?? { x: 1, y: 0 };
    case 'place':
      return normalizeWithFallback({ x: aimDx, y: aimDy }, { x: 1, y: 0 });
    default:
      return assertNever(weapon.firePattern);
  }
}

function projectileOwnerKindForPlayer(player: RuntimePlayer): PublicArenaProjectileOwnerKind {
  return player.form.kind === 'boss' ? 'boss' : 'player';
}

function aimedSpreadDirections(
  aimDx: number,
  aimDy: number,
  count: number,
  spreadRadians: number
): ReadonlyArray<Vector> {
  const length = Math.hypot(aimDx, aimDy);
  if (length === 0) return [];
  const baseAngle = Math.atan2(aimDy, aimDx);
  if (count === 1) {
    return [{ x: Math.cos(baseAngle), y: Math.sin(baseAngle) }];
  }
  const start = baseAngle - spreadRadians / 2;
  const step = spreadRadians / (count - 1);
  const directions: Vector[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = start + step * index;
    directions.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  return directions;
}

function aimedOffsetDirections(
  aimDx: number,
  aimDy: number,
  offsetsRadians: ReadonlyArray<number>
): ReadonlyArray<Vector> {
  const length = Math.hypot(aimDx, aimDy);
  if (length === 0) return [];
  const baseAngle = Math.atan2(aimDy, aimDx);
  return offsetsRadians.map((offset) => {
    const angle = baseAngle + offset;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
}

function fragmentDirections(count: number, spreadRadians: number): ReadonlyArray<Vector> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 1, y: 0 }];
  const start = -spreadRadians / 2;
  const step = spreadRadians / count;
  const directions: Vector[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = start + step * (index + 0.5);
    directions.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  return directions;
}

function arcProjectileMotion(
  player: RuntimePlayer,
  direction: Vector,
  motion: Extract<ProjectileConfig['motion'], { kind: 'arc' }>,
  simTimeMs: number
): Pick<
  RuntimeProjectile,
  | 'motionKind'
  | 'state'
  | 'arcStart'
  | 'arcEnd'
  | 'arcStartSimMs'
  | 'arcEndSimMs'
  | 'vx'
  | 'vy'
> {
  const aimDistance = Math.hypot(player.aim.x - player.x, player.aim.y - player.y);
  const travelDistance = Math.min(motion.range, aimDistance);
  const arcEnd = {
    x: player.x + direction.x * travelDistance,
    y: player.y + direction.y * travelDistance
  };
  return {
    motionKind: 'arc',
    state: 'flying',
    arcStart: { x: player.x, y: player.y },
    arcEnd,
    arcStartSimMs: simTimeMs,
    arcEndSimMs: simTimeMs + Math.max(1, motion.flightMs),
    vx: direction.x * motion.speed,
    vy: direction.y * motion.speed
  };
}

function updateArcProjectilePosition(projectile: RuntimeProjectile, simTimeMs: number): void {
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
  projectile.x = projectile.arcStart.x + (projectile.arcEnd.x - projectile.arcStart.x) * progress;
  projectile.y = projectile.arcStart.y + (projectile.arcEnd.y - projectile.arcStart.y) * progress;
  const durationSec = durationMs / 1000;
  projectile.vx = (projectile.arcEnd.x - projectile.arcStart.x) / durationSec;
  projectile.vy = (projectile.arcEnd.y - projectile.arcStart.y) / durationSec;
}

function groundProjectile(projectile: RuntimeProjectile, simTimeMs: number): void {
  if (projectile.state === 'grounded') {
    return;
  }

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
    projectile.expiresAtSimMs = Math.min(
      projectile.expiresAtSimMs,
      simTimeMs + projectile.groundedLifetimeMs
    );
  }
}

function detonateAtSimMsForTrigger(
  trigger: DetonationTrigger,
  delayMs: number,
  simTimeMs: number
): number | null {
  if (trigger?.kind === 'proximity') return null;
  return simTimeMs + delayMs;
}

function isImpactEligible(projectile: RuntimeProjectile, simTimeMs: number): boolean {
  if (projectile.state === 'flying') {
    return true;
  }
  return projectile.motionKind === 'arc' && projectile.groundAtSimMs === simTimeMs;
}

function weaponConfigFromArchetype(weaponArchetypeId: string): WeaponConfig {
  const archetype = Object.values(GENERATED_WEAPONS).find(
    (candidate) => candidate.id === weaponArchetypeId
  );
  if (archetype === undefined) {
    throw new Error(`Public Arena weapon archetype "${weaponArchetypeId}" is not generated.`);
  }
  return {
    weaponArchetypeId: archetype.id,
    cooldownMs: archetype.cooldownMs,
    firePattern: archetype.firePattern as FirePattern,
    projectile: archetype.projectile as ProjectileConfig
  };
}

function requireBossArchetype(archetypeId: string): GeneratedBossArchetype {
  const archetype = Object.values(GENERATED_BOSSES).find(
    (candidate) => candidate.id === archetypeId
  );
  if (archetype === undefined) {
    throw new Error(`Public Arena boss archetype "${archetypeId}" is not generated.`);
  }
  return archetype;
}

function applyStatsForCurrentLevel(player: RuntimePlayer, refillHp: boolean): void {
  const stats = statsForLevel(player.level);
  player.form = stats.form;
  player.radius = stats.radius;
  player.maxHp = stats.maxHp;
  player.maxSpeed = stats.maxSpeed;
  player.knockbackVelocityScale = stats.knockbackVelocityScale;
  player.knockbackDurationMs = stats.knockbackDurationMs;
  if (refillHp || player.hp > stats.maxHp) {
    player.hp = stats.maxHp;
  }
  clampPlayerPosition(player);
}

function activeKnockback(player: RuntimePlayer, simTimeMs: number): Vector {
  if (player.knockbackUntilSimMs <= 0) {
    return { x: 0, y: 0 };
  }
  if (simTimeMs >= player.knockbackUntilSimMs) {
    clearKnockback(player);
    return { x: 0, y: 0 };
  }
  return { x: player.knockbackVx, y: player.knockbackVy };
}

function applyProjectileKnockback(
  projectile: RuntimeProjectile,
  target: RuntimePlayer,
  simTimeMs: number
): void {
  const direction = normalizeWithFallback({ x: projectile.vx, y: projectile.vy }, { x: 1, y: 0 });
  applyKnockback(target, direction, projectile.knockbackImpulse, simTimeMs);
}

function applyKnockback(
  target: RuntimePlayer,
  direction: Vector,
  impulse: number,
  simTimeMs: number
): void {
  const impulseSpeed = impulse * target.knockbackVelocityScale;
  target.knockbackVx = direction.x * impulseSpeed;
  target.knockbackVy = direction.y * impulseSpeed;
  target.knockbackUntilSimMs = simTimeMs + target.knockbackDurationMs;
}

function clearKnockback(player: RuntimePlayer): void {
  player.knockbackVx = 0;
  player.knockbackVy = 0;
  player.knockbackUntilSimMs = 0;
}

function clampPlayerPosition(player: RuntimePlayer): void {
  player.x = clamp(
    player.x,
    PUBLIC_ARENA_WORLD_BOUNDS.minX + player.radius,
    PUBLIC_ARENA_WORLD_BOUNDS.maxX - player.radius
  );
  player.y = clamp(
    player.y,
    PUBLIC_ARENA_WORLD_BOUNDS.minY + player.radius,
    PUBLIC_ARENA_WORLD_BOUNDS.maxY - player.radius
  );
}

function spawnEvent(player: RuntimePlayer, simTimeMs: number): PublicArenaPresentationEvent {
  return {
    kind: 'spawn',
    simTimeMs,
    playerId: player.id,
    x: player.x,
    y: player.y,
    level: player.level,
    form: player.form
  };
}

function toPlayerSnapshot(player: RuntimePlayer): PublicArenaPlayerSnapshot {
  return {
    id: player.id,
    x: player.x,
    y: player.y,
    hp: player.hp,
    maxHp: player.maxHp,
    level: player.level,
    form: player.form
  };
}

function toProjectileSnapshot(
  projectile: RuntimeProjectile,
  simTimeMs: number
): PublicArenaProjectileSnapshot {
  const visualState = projectileVisualState(projectile, simTimeMs);
  return {
    id: projectile.id,
    ownerId: projectile.ownerId,
    ownerKind: projectile.ownerKind,
    weaponArchetypeId: projectile.weaponArchetypeId,
    originX: projectile.originX,
    originY: projectile.originY,
    x: projectile.x,
    y: projectile.y,
    size: projectile.size,
    state: projectile.state,
    visualState,
    explosionRadius: projectile.explosion?.radius ?? null,
    detonateAtSimMs: projectile.detonateAtSimMs,
    arcEnd: projectile.state === 'flying' ? projectile.arcEnd : null,
    angleRadians: visualState.angleRadians
  };
}

function projectileVisualState(
  projectile: RuntimeProjectile,
  simTimeMs: number
): PublicArenaProjectileSnapshot['visualState'] {
  const archetype = Object.values(GENERATED_WEAPONS).find(
    (candidate) => candidate.id === projectile.weaponArchetypeId
  );
  const speed = Math.hypot(projectile.vx, projectile.vy);
  const angleRadians = speed === 0 ? 0 : Math.atan2(projectile.vy, projectile.vx);
  return {
    angleRadians,
    spinRadians: ((archetype?.projectile.visual.spinRadiansPerSec ?? 0) * simTimeMs) / 1000,
    pulsePhase: (((simTimeMs % 1000) + 1000) % 1000) / 1000
  };
}

function interestRectFor(player: RuntimePlayer): InterestRect {
  const halfWidth = Math.min(PUBLIC_ARENA_INTEREST_WIDTH_WU, PUBLIC_ARENA_WORLD_BOUNDS.width) / 2;
  const halfHeight = Math.min(PUBLIC_ARENA_INTEREST_HEIGHT_WU, PUBLIC_ARENA_WORLD_BOUNDS.height) / 2;
  const centerX = clamp(
    player.x,
    PUBLIC_ARENA_WORLD_BOUNDS.minX + halfWidth,
    PUBLIC_ARENA_WORLD_BOUNDS.maxX - halfWidth
  );
  const centerY = clamp(
    player.y,
    PUBLIC_ARENA_WORLD_BOUNDS.minY + halfHeight,
    PUBLIC_ARENA_WORLD_BOUNDS.maxY - halfHeight
  );
  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight
  };
}

function playerIntersectsInterest(player: RuntimePlayer, rect: InterestRect): boolean {
  return circleIntersectsRect(player.x, player.y, player.radius, rect);
}

function projectileIntersectsInterest(projectile: RuntimeProjectile, rect: InterestRect): boolean {
  const radius = Math.max(projectile.size.width, projectile.size.height) / 2;
  return circleIntersectsRect(projectile.x, projectile.y, radius, rect);
}

function circleIntersectsRect(x: number, y: number, radius: number, rect: InterestRect): boolean {
  return (
    x + radius >= rect.minX &&
    x - radius <= rect.maxX &&
    y + radius >= rect.minY &&
    y - radius <= rect.maxY
  );
}

function isOutsideArena(point: Vector): boolean {
  return (
    point.x < PUBLIC_ARENA_WORLD_BOUNDS.minX ||
    point.x > PUBLIC_ARENA_WORLD_BOUNDS.maxX ||
    point.y < PUBLIC_ARENA_WORLD_BOUNDS.minY ||
    point.y > PUBLIC_ARENA_WORLD_BOUNDS.maxY
  );
}

function normalize(vector: Vector): Vector {
  const x = finiteOr(vector.x, 0);
  const y = finiteOr(vector.y, 0);
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return {
    x: x / length,
    y: y / length
  };
}

function normalizeWithFallback(vector: Vector, fallback: Vector): Vector {
  const x = finiteOr(vector.x, 0);
  const y = finiteOr(vector.y, 0);
  const length = Math.hypot(x, y);
  if (length === 0) {
    return fallback;
  }
  return {
    x: x / length,
    y: y / length
  };
}

function normalizedExplosionDirection(
  projectile: RuntimeProjectile,
  target: RuntimePlayer
): Vector {
  return normalizeWithFallback(
    { x: target.x - projectile.x, y: target.y - projectile.y },
    normalizeWithFallback({ x: projectile.vx, y: projectile.vy }, { x: 1, y: 0 })
  );
}

function distanceSquared(a: Vector, b: Vector): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  return clamp(finiteOr(value, fallback), min, max);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function assertNever(value: never): never {
  throw new Error(`unexpected public arena simulation value: ${String(value)}`);
}
