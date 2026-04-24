import type { BossArchetype } from '../../shared/content/bosses';
import type { EnemyArchetype } from '../../shared/content/enemies';
import type { WeaponArchetype } from '../../shared/content/weapons';
import type { RuntimeEvent } from '../../shared/events';

type SlimeKind = 'enemy' | 'boss';

type ImpactEffectStoreInit = Readonly<{
  enemyRegistry: Readonly<Record<string, EnemyArchetype>>;
  bossRegistry: Readonly<Record<string, BossArchetype>>;
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>;
}>;

export type HitImpulseEffect = Readonly<{
  targetId: number;
  targetKind: SlimeKind;
  startedAtMs: number;
  expiresAtMs: number;
  dirX: number;
  dirY: number;
  strength: number;
}>;

export type SlimeDropletEffect = Readonly<{
  id: number;
  color: number;
  shape: ReadonlyArray<Readonly<{ angle: number; radiusScale: number }>>;
  startX: number;
  startY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  startedAtMs: number;
  landsAtMs: number;
  stainGrowUntilMs: number;
  expiresAtMs: number;
  opacity: number;
  stainScale: number;
  landed: boolean;
}>;

export type DeathGhostEffect = Readonly<{
  id: number;
  entityId: number;
  entityKind: SlimeKind;
  archetypeId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  startedAtMs: number;
  expiresAtMs: number;
  opacity: number;
}>;

export type ImpactEffectSnapshot = Readonly<{
  hitImpulses: ReadonlyArray<HitImpulseEffect>;
  droplets: ReadonlyArray<SlimeDropletEffect>;
  deathGhosts: ReadonlyArray<DeathGhostEffect>;
}>;

export type ImpactEffectStore = Readonly<{
  handleEvent(event: RuntimeEvent, nowMs: number): void;
  update(nowMs: number): void;
  clear(): void;
  snapshot(): ImpactEffectSnapshot;
}>;

const HIT_IMPULSE_TTL_MS = 140;
const HIT_DROPLET_BASE_COUNT = 7;
const DEATH_DROPLET_BASE_COUNT = 18;
const DROPLET_FLIGHT_MIN_MS = 120;
const DROPLET_FLIGHT_MAX_MS = 360;
const STAIN_GROW_MS = 2000;
const STAIN_TTL_MS = 60_000;
const STAIN_FADE_MS = 8000;
const DEATH_GHOST_TTL_MS = 1400;
const MAX_HIT_IMPULSES = 128;
const MAX_DROPLETS = 420;
const MAX_DEATH_GHOSTS = 32;

export function createImpactEffectStore(init: ImpactEffectStoreInit): ImpactEffectStore {
  const hitImpulses = new Map<number, HitImpulseEffect>();
  let droplets: SlimeDropletEffect[] = [];
  let deathGhosts: DeathGhostEffect[] = [];
  let nextDropletId = 1;
  let nextGhostId = 1;

  function handleEvent(event: RuntimeEvent, nowMs: number): void {
    switch (event.kind) {
      case 'hit':
        handleHit(event, nowMs);
        return;
      case 'death':
        handleDeath(event, nowMs);
        return;
      default:
        return;
    }
  }

  function handleHit(event: Extract<RuntimeEvent, { kind: 'hit' }>, nowMs: number): void {
    if (!isSlimeKind(event.targetKind) || event.targetArchetypeId === null) return;
    const color = resolveSlimeColor(event.targetKind, event.targetArchetypeId);
    if (color === null) return;

    const force = resolveWeaponForce(event.weaponArchetypeId);
    const dir = normalizeOrFallback(event.impactDirX, event.impactDirY, 1, 0);
    hitImpulses.set(event.targetId, {
      targetId: event.targetId,
      targetKind: event.targetKind,
      startedAtMs: nowMs,
      expiresAtMs: nowMs + HIT_IMPULSE_TTL_MS,
      dirX: dir.x,
      dirY: dir.y,
      strength: force
    });
    cullMapToBudget(hitImpulses, MAX_HIT_IMPULSES);
    spawnDroplets({
      seed: hashEventSeed(event.simTime, event.projectileId, event.targetId, event.weaponArchetypeId),
      nowMs,
      color,
      x: event.x,
      y: event.y,
      dirX: dir.x,
      dirY: dir.y,
      force,
      kind: 'hit'
    });
  }

  function handleDeath(event: Extract<RuntimeEvent, { kind: 'death' }>, nowMs: number): void {
    if (!isSlimeKind(event.entityKind) || event.archetypeId === null) return;
    const color = resolveSlimeColor(event.entityKind, event.archetypeId);
    if (color === null) return;

    const force =
      event.weaponArchetypeId === null ? 0 : resolveWeaponForce(event.weaponArchetypeId);
    const dir = normalizeOrFallback(event.impactDirX, event.impactDirY, 0, 1);
    hitImpulses.delete(event.entityId);
    deathGhosts.push({
      id: nextGhostId,
      entityId: event.entityId,
      entityKind: event.entityKind,
      archetypeId: event.archetypeId,
      startX: event.x,
      startY: event.y,
      x: event.x,
      y: event.y,
      vx: dir.x * (0.45 + force * 0.04),
      vy: 1.8 + Math.max(0, dir.y) * 0.35 + force * 0.025,
      startedAtMs: nowMs,
      expiresAtMs: nowMs + DEATH_GHOST_TTL_MS,
      opacity: 1
    });
    nextGhostId += 1;
    cullArrayToBudget(deathGhosts, MAX_DEATH_GHOSTS);
    spawnDroplets({
      seed: hashEventSeed(event.simTime, event.entityId, event.entityId, event.archetypeId),
      nowMs,
      color,
      x: event.x,
      y: event.y,
      dirX: dir.x,
      dirY: dir.y,
      force,
      kind: 'death'
    });
  }

  function spawnDroplets(initDroplets: Readonly<{
    seed: number;
    nowMs: number;
    color: number;
    x: number;
    y: number;
    dirX: number;
    dirY: number;
    force: number;
    kind: 'hit' | 'death';
  }>): void {
    const rng = createHashSequence(initDroplets.seed);
    const forceScale = Math.min(2.4, 0.75 + initDroplets.force / 8);
    const countBase =
      initDroplets.kind === 'death' ? DEATH_DROPLET_BASE_COUNT : HIT_DROPLET_BASE_COUNT;
    const count = Math.round(countBase + forceScale * (initDroplets.kind === 'death' ? 5 : 3));
    const spread = initDroplets.kind === 'death' ? Math.PI * 1.35 : Math.PI * 0.55;
    const baseAngle = Math.atan2(initDroplets.dirY, initDroplets.dirX);

    for (let i = 0; i < count; i += 1) {
      const lateral = (rng.nextFloat() - 0.5) * spread;
      const angle = baseAngle + lateral;
      const speed = (0.9 + rng.nextFloat() * 1.8) * forceScale;
      const flightMs =
        DROPLET_FLIGHT_MIN_MS +
        rng.nextFloat() * (DROPLET_FLIGHT_MAX_MS - DROPLET_FLIGHT_MIN_MS);
      const radius =
        (initDroplets.kind === 'death' ? 0.08 : 0.045) *
        (0.75 + rng.nextFloat() * 0.7) *
        Math.sqrt(forceScale);
      const shape = createBlobShape(rng, initDroplets.kind);
      droplets.push({
        id: nextDropletId,
        color: initDroplets.color,
        shape,
        startX: initDroplets.x,
        startY: initDroplets.y,
        x: initDroplets.x,
        y: initDroplets.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        startedAtMs: initDroplets.nowMs,
        landsAtMs: initDroplets.nowMs + flightMs,
        stainGrowUntilMs: initDroplets.nowMs + flightMs + STAIN_GROW_MS,
        expiresAtMs: initDroplets.nowMs + flightMs + STAIN_TTL_MS,
        opacity: 1,
        stainScale: 1,
        landed: false
      });
      nextDropletId += 1;
    }
    cullArrayToBudget(droplets, MAX_DROPLETS);
  }

  function update(nowMs: number): void {
    for (const [targetId, impulse] of hitImpulses) {
      if (nowMs >= impulse.expiresAtMs) {
        hitImpulses.delete(targetId);
      }
    }
    droplets = droplets
      .filter((droplet) => nowMs < droplet.expiresAtMs)
      .map((droplet) => updateDroplet(droplet, nowMs));
    deathGhosts = deathGhosts
      .filter((ghost) => nowMs < ghost.expiresAtMs)
      .map((ghost) => updateDeathGhost(ghost, nowMs));
  }

  function clear(): void {
    hitImpulses.clear();
    droplets = [];
    deathGhosts = [];
  }

  function snapshot(): ImpactEffectSnapshot {
    return {
      hitImpulses: Array.from(hitImpulses.values()),
      droplets,
      deathGhosts
    };
  }

  function resolveSlimeColor(kind: SlimeKind, archetypeId: string): number | null {
    const archetype =
      kind === 'enemy' ? init.enemyRegistry[archetypeId] : init.bossRegistry[archetypeId];
    return archetype?.color ?? null;
  }

  function resolveWeaponForce(weaponArchetypeId: string): number {
    return init.weaponRegistry[weaponArchetypeId]?.knockbackImpulse ?? 0;
  }

  return {
    handleEvent,
    update,
    clear,
    snapshot
  };
}

function updateDroplet(droplet: SlimeDropletEffect, nowMs: number): SlimeDropletEffect {
  const flightMs = droplet.landsAtMs - droplet.startedAtMs;
  const elapsedMs = Math.max(0, nowMs - droplet.startedAtMs);
  const flightT = flightMs <= 0 ? 1 : Math.min(1, elapsedMs / flightMs);
  const landed = nowMs >= droplet.landsAtMs;
  const growSpan = droplet.stainGrowUntilMs - droplet.landsAtMs;
  const growT =
    growSpan <= 0
      ? 1
      : Math.max(0, Math.min(1, (nowMs - droplet.landsAtMs) / growSpan));
  const fadeT = Math.max(0, nowMs - (droplet.expiresAtMs - STAIN_FADE_MS)) / STAIN_FADE_MS;
  const opacity = Math.max(0, 1 - fadeT);
  return {
    ...droplet,
    x: droplet.startX + droplet.vx * (flightT * flightMs / 1000),
    y: droplet.startY + droplet.vy * (flightT * flightMs / 1000),
    opacity,
    stainScale: landed ? 1 + 0.45 * growT : 1,
    landed
  };
}

function updateDeathGhost(ghost: DeathGhostEffect, nowMs: number): DeathGhostEffect {
  const lifetimeMs = ghost.expiresAtMs - ghost.startedAtMs;
  const elapsedMs = Math.max(0, nowMs - ghost.startedAtMs);
  const t = lifetimeMs <= 0 ? 1 : Math.min(1, elapsedMs / lifetimeMs);
  return {
    ...ghost,
    x: ghost.startX + ghost.vx * (elapsedMs / 1000),
    y: ghost.startY + ghost.vy * (elapsedMs / 1000),
    opacity: Math.max(0, 1 - t)
  };
}

function isSlimeKind(kind: string): kind is SlimeKind {
  return kind === 'enemy' || kind === 'boss';
}

function normalizeOrFallback(
  x: number | null,
  y: number | null,
  fallbackX: number,
  fallbackY: number
): Readonly<{ x: number; y: number }> {
  const vx = x ?? fallbackX;
  const vy = y ?? fallbackY;
  const len = Math.hypot(vx, vy);
  if (len <= 0) {
    return { x: fallbackX, y: fallbackY };
  }
  return { x: vx / len, y: vy / len };
}

function cullMapToBudget<K, V>(map: Map<K, V>, budget: number): void {
  while (map.size > budget) {
    const oldestKey = map.keys().next().value as K | undefined;
    if (oldestKey === undefined) return;
    map.delete(oldestKey);
  }
}

function cullArrayToBudget<T>(items: T[], budget: number): void {
  if (items.length <= budget) return;
  items.splice(0, items.length - budget);
}

function hashEventSeed(
  simTime: number,
  firstId: number,
  secondId: number,
  text: string
): number {
  let hash = 2166136261;
  hash = mixHash(hash, Math.trunc(simTime));
  hash = mixHash(hash, firstId);
  hash = mixHash(hash, secondId);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mixHash(hash: number, value: number): number {
  hash ^= value >>> 0;
  return Math.imul(hash, 16777619);
}

function createHashSequence(seed: number): Readonly<{ nextFloat(): number }> {
  let state = seed >>> 0;
  return {
    nextFloat(): number {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  };
}

function createBlobShape(
  rng: Readonly<{ nextFloat(): number }>,
  kind: 'hit' | 'death'
): ReadonlyArray<Readonly<{ angle: number; radiusScale: number }>> {
  const points = kind === 'death' ? 11 : 8;
  const jitter = kind === 'death' ? 0.38 : 0.3;
  const shape: Array<Readonly<{ angle: number; radiusScale: number }>> = [];
  for (let i = 0; i < points; i += 1) {
    const baseAngle = (i / points) * Math.PI * 2;
    const angle = baseAngle + (rng.nextFloat() - 0.5) * (Math.PI / points) * 0.8;
    const radiusScale = 1 - jitter / 2 + rng.nextFloat() * jitter;
    shape.push({ angle, radiusScale });
  }
  return shape;
}
