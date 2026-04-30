import { SIM_STEP_MS } from '../../src/shared/timing.js';
import * as GENERATED_BOSSES from '../../src/shared/content/bosses.generated.js';
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
type FirePattern = GeneratedWeaponArchetype['firePattern'];

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
}>;

type WeaponConfig = Readonly<{
  weaponArchetypeId: string;
  cooldownMs: number;
  firePattern: FirePattern;
  projectile: GeneratedWeaponArchetype['projectile'];
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
  weaponArchetypeId: string;
  motionKind: 'linear' | 'arc';
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
  groundOnImpact: boolean;
  groundedLifetimeMs: number | null;
  groundAtSimMs: number | null;
  expiresAtSimMs: number;
  angleRadians: number;
};

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
  maxSpeed: BOSS_ARCHETYPE.maxSpeed
};

const REGULAR_WEAPON = weaponConfigFromArchetype(PUBLIC_ARENA_REGULAR_WEAPON_ID);
const BOSS_WEAPON = weaponConfigFromArchetype(PUBLIC_ARENA_BOSS_WEAPON_ID);

export function createPublicArenaSimulation(): PublicArenaSimulation {
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
    removeExpiredProjectiles();
  }

  function movePlayers(): void {
    const stepSeconds = SIM_STEP_MS / 1000;
    for (const player of players.values()) {
      if (player.moveDir.x === 0 && player.moveDir.y === 0) {
        continue;
      }
      player.x += player.moveDir.x * player.maxSpeed * stepSeconds;
      player.y += player.moveDir.y * player.maxSpeed * stepSeconds;
      clampPlayerPosition(player);
    }
  }

  function fireWeapons(): void {
    for (const player of players.values()) {
      if (!player.firing || simTimeMs < player.nextFireAtSimMs) {
        continue;
      }

      const weapon = weaponForPlayer(player);
      for (const direction of fireDirections(player, weapon)) {
        spawnProjectile(player, weapon, direction);
      }
      player.nextFireAtSimMs = simTimeMs + weapon.cooldownMs;
    }
  }

  function spawnProjectile(player: RuntimePlayer, weapon: WeaponConfig, direction: Vector): void {
    const normalized = normalizeWithFallback(direction, { x: 1, y: 0 });
    const baseProjectile = {
      id: `projectile-${nextProjectileSeq}`,
      ownerId: player.id,
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
      groundOnImpact: weapon.projectile.groundOnImpact,
      groundedLifetimeMs: weapon.projectile.groundedLifetimeMs,
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
        throw new Error(`Public Arena weapon ${weapon.weaponArchetypeId} uses unsupported placed motion.`);
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
        targetId: target.id,
        weaponArchetypeId: projectile.weaponArchetypeId,
        damage: projectile.damage,
        x: projectile.x,
        y: projectile.y,
        impactDirX: normalizeWithFallback({ x: projectile.vx, y: projectile.vy }, { x: 1, y: 0 }).x,
        impactDirY: normalizeWithFallback({ x: projectile.vx, y: projectile.vy }, { x: 1, y: 0 }).y
      });

      target.hp = Math.max(0, target.hp - projectile.damage);
      if (projectile.groundOnImpact) {
        groundProjectile(projectile, simTimeMs);
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

  function killPlayer(victim: RuntimePlayer, killerId: PublicArenaPlayerId, weaponArchetypeId: string): void {
    events.push({
      kind: 'death',
      simTimeMs,
      playerId: victim.id,
      killerId,
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
      projectiles: [...projectiles.values()].map(toProjectileSnapshot)
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
        .map(toProjectileSnapshot)
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
  return {
    form: { kind: 'slime', archetypeId },
    radius,
    maxHp,
    maxSpeed
  };
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

function weaponForPlayer(player: RuntimePlayer): WeaponConfig {
  return player.form.kind === 'boss' ? BOSS_WEAPON : REGULAR_WEAPON;
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
      return [];
    default:
      return assertNever(weapon.firePattern);
  }
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

function arcProjectileMotion(
  player: RuntimePlayer,
  direction: Vector,
  motion: Extract<GeneratedWeaponArchetype['projectile']['motion'], { kind: 'arc' }>,
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
  if (projectile.groundedLifetimeMs !== null) {
    projectile.expiresAtSimMs = Math.min(
      projectile.expiresAtSimMs,
      simTimeMs + projectile.groundedLifetimeMs
    );
  }
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
  if (archetype.projectile.motion.kind === 'placed') {
    throw new Error(`Public Arena weapon ${weaponArchetypeId} uses unsupported placed motion.`);
  }
  return {
    weaponArchetypeId: archetype.id,
    cooldownMs: archetype.cooldownMs,
    firePattern: archetype.firePattern,
    projectile: archetype.projectile
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
  if (refillHp || player.hp > stats.maxHp) {
    player.hp = stats.maxHp;
  }
  clampPlayerPosition(player);
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

function toProjectileSnapshot(projectile: RuntimeProjectile): PublicArenaProjectileSnapshot {
  return {
    id: projectile.id,
    ownerId: projectile.ownerId,
    weaponArchetypeId: projectile.weaponArchetypeId,
    originX: projectile.originX,
    originY: projectile.originY,
    x: projectile.x,
    y: projectile.y,
    size: projectile.size,
    angleRadians: projectile.angleRadians
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
