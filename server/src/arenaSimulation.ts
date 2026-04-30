import { SIM_STEP_MS } from '../../src/shared/timing.js';
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

export const PUBLIC_ARENA_REGULAR_WEAPON_ID = 'rock-thrower';
export const PUBLIC_ARENA_BOSS_WEAPON_ID = 'fireball-staff';
export const PUBLIC_ARENA_BOSS_ARCHETYPE_ID = 'boss-tower-sentinel';
export const PUBLIC_ARENA_INTEREST_WIDTH_WU = PUBLIC_ARENA_WORLD_BOUNDS.width;
export const PUBLIC_ARENA_INTEREST_HEIGHT_WU = 26;
export const PUBLIC_ARENA_SPAWN_PROTECTION_MS = 900;
export const PUBLIC_ARENA_SLIME_FORM_CHAIN = [
  'slime-one-eye',
  'slime-hornling',
  'slime-many-eye',
  'slime-stonehead',
  'slime-shell'
] as const;
export const PUBLIC_ARENA_BOSS_LEVEL = PUBLIC_ARENA_SLIME_FORM_CHAIN.length + 1;

type Vector = Readonly<{ x: number; y: number }>;

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
  speed: number;
  hitRadius: number;
  damage: number;
  ttlMs: number;
  size: Readonly<{ width: number; height: number }>;
  pattern: 'aimedSingle' | 'cardinalBurst';
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
  originX: number;
  originY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: Readonly<{ width: number; height: number }>;
  hitRadius: number;
  damage: number;
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

const REGULAR_FORMS: ReadonlyArray<ActorStats> = [
  regularForm('slime-one-eye', 0.4, 2, 5),
  regularForm('slime-hornling', 0.5, 3, 5),
  regularForm('slime-many-eye', 0.6, 4, 4.8),
  regularForm('slime-stonehead', 0.72, 7, 4.3),
  regularForm('slime-shell', 0.65, 6, 4.6)
];

const BOSS_STATS: ActorStats = {
  form: { kind: 'boss', archetypeId: PUBLIC_ARENA_BOSS_ARCHETYPE_ID },
  radius: 1.3,
  maxHp: 130,
  maxSpeed: 1.2
};

const REGULAR_WEAPON: WeaponConfig = {
  weaponArchetypeId: PUBLIC_ARENA_REGULAR_WEAPON_ID,
  cooldownMs: 700,
  speed: 8,
  hitRadius: 0.18,
  damage: 3,
  ttlMs: 1300,
  size: { width: 0.5416666666666666, height: 0.49166666666666664 },
  pattern: 'aimedSingle'
};

const BOSS_WEAPON: WeaponConfig = {
  weaponArchetypeId: PUBLIC_ARENA_BOSS_WEAPON_ID,
  cooldownMs: 850,
  speed: 9,
  hitRadius: 0.2,
  damage: 2,
  ttlMs: 1400,
  size: { width: 0.7375, height: 0.7625 },
  pattern: 'cardinalBurst'
};

const CARDINAL_DIRECTIONS: ReadonlyArray<Vector> = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 }
];

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
    const projectile: RuntimeProjectile = {
      id: `projectile-${nextProjectileSeq}`,
      ownerId: player.id,
      weaponArchetypeId: weapon.weaponArchetypeId,
      originX: player.x,
      originY: player.y,
      x: player.x,
      y: player.y,
      vx: normalized.x * weapon.speed,
      vy: normalized.y * weapon.speed,
      size: weapon.size,
      hitRadius: weapon.hitRadius,
      damage: weapon.damage,
      expiresAtSimMs: simTimeMs + weapon.ttlMs,
      angleRadians: Math.atan2(normalized.y, normalized.x)
    };
    nextProjectileSeq += 1;
    projectiles.set(projectile.id, projectile);
  }

  function moveProjectiles(): void {
    const stepSeconds = SIM_STEP_MS / 1000;
    for (const projectile of projectiles.values()) {
      projectile.x += projectile.vx * stepSeconds;
      projectile.y += projectile.vy * stepSeconds;
    }
  }

  function resolveProjectileHits(): void {
    const defeatedThisTick = new Set<PublicArenaPlayerId>();

    for (const projectile of [...projectiles.values()]) {
      const target = firstProjectileTarget(projectile, defeatedThisTick);
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
      projectiles.delete(projectile.id);
      if (target.hp === 0) {
        defeatedThisTick.add(target.id);
        killPlayer(target, projectile.ownerId, projectile.weaponArchetypeId);
      }
    }
  }

  function firstProjectileTarget(
    projectile: RuntimeProjectile,
    defeatedThisTick: ReadonlySet<PublicArenaPlayerId>
  ): RuntimePlayer | null {
    for (const player of players.values()) {
      if (
        player.id === projectile.ownerId ||
        defeatedThisTick.has(player.id) ||
        isSpawnProtected(player)
      ) {
        continue;
      }
      const reach = projectile.hitRadius + player.radius;
      if (distanceSquared(projectile, player) <= reach * reach) {
        return player;
      }
    }
    return null;
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
      if (projectile.expiresAtSimMs <= simTimeMs || isOutsideArena(projectile)) {
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
    return firstRegularForm();
  }
  return stats;
}

function firstRegularForm(): ActorStats {
  const stats = REGULAR_FORMS[0];
  if (stats === undefined) {
    throw new Error('public arena must have at least one regular form');
  }
  return stats;
}

function weaponForPlayer(player: RuntimePlayer): WeaponConfig {
  return player.form.kind === 'boss' ? BOSS_WEAPON : REGULAR_WEAPON;
}

function fireDirections(player: RuntimePlayer, weapon: WeaponConfig): ReadonlyArray<Vector> {
  switch (weapon.pattern) {
    case 'aimedSingle':
      return [{ x: player.aim.x - player.x, y: player.aim.y - player.y }];
    case 'cardinalBurst':
      return CARDINAL_DIRECTIONS;
    default:
      return assertNever(weapon.pattern);
  }
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
