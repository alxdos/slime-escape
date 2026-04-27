import { describe, expect, it } from 'vitest';

import { PISTOL, type WeaponModifier } from '../shared/content/weapons';
import type { WeaponTimedEffectHudSnapshot, ZoneSnapshot } from '../shared/snapshot';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../shared/timing';

import { createEntityStore, type EntityId } from './EntityStore';
import type { EncounterContext } from './SessionFlowSystem';
import { createSnapshotExportSystem, type SnapshotSources } from './SnapshotExportSystem';

const TICKS_PER_SNAPSHOT = Math.round(SNAPSHOT_INTERVAL_MS / SIM_STEP_MS);
const IDLE_ZONE: ZoneSnapshot = { mode: 'disabled', margin: 0 };
function squareContactBox(radius: number) {
  return { width: radius * 2, height: radius * 2 };
}

const NO_SOURCES: SnapshotSources = {
  encounter: null,
  zone: IDLE_ZONE,
  waveProgress: null,
  weaponHud: null
};
const STATIONARY_TEST_ENEMY = {
  archetypeId: 'test-stationary-enemy',
  radius: 0.6,
  contactBox: squareContactBox(0.6),
  maxHp: 3,
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766
} as const;

describe('SnapshotExportSystem', () => {
  it('emits the player entity with kind "player"', () => {
    const store = createEntityStore();
    store.spawnPlayer({
      position: { x: 3, y: -2 },
      radius: 0.5,
      contactBox: squareContactBox(0.5),
      maxSpeed: 6,
      maxHp: 1
    });
    const exporter = createSnapshotExportSystem();

    const snapshot = exporter.onTick(0, store, NO_SOURCES);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.entities).toHaveLength(1);
    const entity = snapshot?.entities[0];
    expect(entity?.kind).toBe('player');
    expect(entity?.x).toBe(3);
    expect(entity?.y).toBe(-2);
    expect(snapshot?.simTimeMs).toBe(0);
    expect(snapshot?.bossHud).toBeNull();
  });

  it('emits empty entity list when no player is spawned', () => {
    const store = createEntityStore();
    const exporter = createSnapshotExportSystem();

    const snapshot = exporter.onTick(0, store, NO_SOURCES);

    expect(snapshot?.entities).toHaveLength(0);
  });

  it('emits exactly once per TICKS_PER_SNAPSHOT', () => {
    const store = createEntityStore();
    store.spawnPlayer({
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: squareContactBox(0.5),
      maxSpeed: 6,
      maxHp: 1
    });
    const exporter = createSnapshotExportSystem();

    let emitted = 0;
    for (let tick = 0; tick < TICKS_PER_SNAPSHOT * 3; tick += 1) {
      const snapshot = exporter.onTick(tick * SIM_STEP_MS, store, NO_SOURCES);
      if (snapshot !== null) emitted += 1;
    }

    expect(emitted).toBe(3);
  });

  it('reset() restores the cadence so the next call emits', () => {
    const store = createEntityStore();
    store.spawnPlayer({
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: squareContactBox(0.5),
      maxSpeed: 6,
      maxHp: 1
    });
    const exporter = createSnapshotExportSystem();

    exporter.onTick(0, store, NO_SOURCES);
    expect(exporter.onTick(SIM_STEP_MS, store, NO_SOURCES)).toBeNull();

    exporter.reset();
    expect(exporter.onTick(SIM_STEP_MS, store, NO_SOURCES)).not.toBeNull();
  });

  it('emits enemy with archetypeId/hp/maxHp and projectile with weaponArchetypeId/ownerKind', () => {
    const store = createEntityStore();
    store.spawnEnemy({
      archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
      position: { x: 5, y: 0 },
      radius: STATIONARY_TEST_ENEMY.radius,
      contactBox: STATIONARY_TEST_ENEMY.contactBox,
      behavior: 'stationary',
      guaranteedDrops: ['magnet'],
      maxHp: STATIONARY_TEST_ENEMY.maxHp,
      maxSpeed: STATIONARY_TEST_ENEMY.maxSpeed,
      contactDamage: STATIONARY_TEST_ENEMY.contactDamage,
      contactCooldownMs: STATIONARY_TEST_ENEMY.contactCooldownMs,
      knockbackBaseImpulse: STATIONARY_TEST_ENEMY.knockbackBaseImpulse,
      knockbackVelocityScale: STATIONARY_TEST_ENEMY.knockbackVelocityScale,
      knockbackDurationMs: STATIONARY_TEST_ENEMY.knockbackDurationMs,
      color: STATIONARY_TEST_ENEMY.color
    });
    const runtimeProjectileSize = {
      width: PISTOL.projectile.size.width * 1.75,
      height: PISTOL.projectile.size.height * 1.75
    };
    const runtimeProjectile = store.spawnProjectile({
      weaponArchetypeId: PISTOL.id,
      ownerId: 1 as EntityId,
      ownerKind: 'player',
      motionKind: 'linear',
      origin: { x: 0, y: 0 },
      position: { x: 1, y: 0 },
      velocity: { vx: 24, vy: 0 },
      size: runtimeProjectileSize,
      hitRadius: PISTOL.projectile.hitRadius,
      impactDamage: PISTOL.projectile.impactDamage,
      knockbackImpulse: PISTOL.projectile.knockbackImpulse,
      pierceRemaining: PISTOL.projectile.pierceCount,
      groundOnImpact: PISTOL.projectile.groundOnImpact,
      groundedLifetimeMs: PISTOL.projectile.groundedLifetimeMs,
      explosion: PISTOL.projectile.explosion,
      groundAtSimMs: null,
      expireAtSimMs: 1000
    });

    const exporter = createSnapshotExportSystem();
    const snapshot = exporter.onTick(0, store, NO_SOURCES);

    const enemy = snapshot?.entities.find((e) => e.kind === 'enemy');
    expect(enemy).toBeDefined();
    if (enemy?.kind !== 'enemy') throw new Error('expected enemy snapshot');
    expect(enemy.archetypeId).toBe(STATIONARY_TEST_ENEMY.archetypeId);
    expect(enemy.hp).toBe(STATIONARY_TEST_ENEMY.maxHp);
    expect(enemy.maxHp).toBe(STATIONARY_TEST_ENEMY.maxHp);
    expect(enemy.carrierDropMarker).toBe('reward');

    const projectile = snapshot?.entities.find((e) => e.kind === 'projectile');
    expect(projectile).toBeDefined();
    if (projectile?.kind !== 'projectile') throw new Error('expected projectile snapshot');
    expect(projectile.weaponArchetypeId).toBe(PISTOL.id);
    expect(projectile.ownerKind).toBe('player');
    expect(projectile.originX).toBe(0);
    expect(projectile.originY).toBe(0);
    expect(projectile.state).toBe('flying');
    expect(projectile.size).toEqual(runtimeProjectileSize);
    expect(projectile.size).not.toBe(runtimeProjectile.size);
    expect(projectile.visualState.angleRadians).toBeCloseTo(0);
    expect(projectile.visualState.spinRadians).toBe(0);
    expect(projectile.visualState.pulsePhase).toBe(0);
    expect(projectile.explosionRadius).toBeNull();
    expect(projectile.detonateAtSimMs).toBeNull();
  });

  it('omits removed entities (no tombstones in entities)', () => {
    const store = createEntityStore();
    const enemy = store.spawnEnemy({
      archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
      position: { x: 0, y: 0 },
      radius: STATIONARY_TEST_ENEMY.radius,
      contactBox: STATIONARY_TEST_ENEMY.contactBox,
      behavior: 'stationary',
      maxHp: 1,
      maxSpeed: STATIONARY_TEST_ENEMY.maxSpeed,
      contactDamage: STATIONARY_TEST_ENEMY.contactDamage,
      contactCooldownMs: STATIONARY_TEST_ENEMY.contactCooldownMs,
      knockbackBaseImpulse: STATIONARY_TEST_ENEMY.knockbackBaseImpulse,
      knockbackVelocityScale: STATIONARY_TEST_ENEMY.knockbackVelocityScale,
      knockbackDurationMs: STATIONARY_TEST_ENEMY.knockbackDurationMs,
      color: STATIONARY_TEST_ENEMY.color
    });
    const exporter = createSnapshotExportSystem();

    expect(exporter.onTick(0, store, NO_SOURCES)?.entities).toHaveLength(1);

    store.removeEnemy(enemy.id);
    exporter.reset();

    const after = exporter.onTick(0, store, NO_SOURCES);
    expect(after?.entities).toHaveLength(0);
  });

  it('emits field effect presentation fields', () => {
    const store = createEntityStore();
    const fieldEffect = store.spawnFieldEffect({
      archetypeId: 'acid-puddle',
      ownerId: null,
      ownerKind: null,
      position: { x: 2, y: -1 },
      radius: 1.5,
      applyEveryMs: 500,
      nextApplySimMs: 0,
      expireAtSimMs: 2500,
      effects: [{ kind: 'damage', amount: 1 }]
    });
    const exporter = createSnapshotExportSystem();

    const snapshot = exporter.onTick(0, store, NO_SOURCES);
    const entity = snapshot?.entities.find((e) => e.kind === 'fieldEffect');

    expect(entity).toBeDefined();
    if (entity?.kind !== 'fieldEffect') throw new Error('expected field effect snapshot');
    expect(entity.id).toBe(fieldEffect.id);
    expect(entity.archetypeId).toBe('acid-puddle');
    expect(entity.x).toBe(2);
    expect(entity.y).toBe(-1);
    expect(entity.radius).toBe(1.5);
    expect(entity.expiresAtSimMs).toBe(2500);
  });
});

describe('SnapshotExportSystem top-level fields', () => {
  function spawnPlayerAt(store: ReturnType<typeof createEntityStore>) {
    return store.spawnPlayer({
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: squareContactBox(0.5),
      maxSpeed: 6,
      maxHp: 5
    });
  }

  it('emits PlayerSnapshot.hp/maxHp from EntityStore', () => {
    const store = createEntityStore();
    const player = spawnPlayerAt(store);
    player.hp = 3;
    const exporter = createSnapshotExportSystem();
    const snap = exporter.onTick(0, store, NO_SOURCES);
    const playerSnap = snap?.entities.find((e) => e.kind === 'player');
    if (playerSnap?.kind !== 'player') throw new Error('expected player snapshot');
    expect(playerSnap.hp).toBe(3);
    expect(playerSnap.maxHp).toBe(5);
  });

  it('encounter is null without a session and reflects context.elapsedMs otherwise', () => {
    const store = createEntityStore();
    spawnPlayerAt(store);
    const exporter = createSnapshotExportSystem();

    expect(exporter.onTick(0, store, NO_SOURCES)?.encounter).toBeNull();

    const ctx: EncounterContext = {
      encounter: {
        id: 'wave-1',
        type: 'wave',
        backgroundId: null,
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'never', next: 'sequential' },
        tuning: null
      },
      index: 2,
      startSimMs: 1000
    };
    exporter.reset();
    const snap = exporter.onTick(1500, store, {
      encounter: ctx,
      zone: IDLE_ZONE,
      waveProgress: null,
      weaponHud: null
    });
    expect(snap?.encounter).toEqual({
      id: 'wave-1',
      type: 'wave',
      index: 2,
      elapsedMs: 500
    });
  });

  it('zone is copied verbatim into the snapshot', () => {
    const store = createEntityStore();
    spawnPlayerAt(store);
    const exporter = createSnapshotExportSystem();
    const snap = exporter.onTick(0, store, {
      encounter: null,
      zone: { mode: 'shrink', margin: 2.5 },
      waveProgress: null,
      weaponHud: null
    });
    expect(snap?.zone).toEqual({ mode: 'shrink', margin: 2.5 });
  });

  it('waveProgress passes through and is null when source is null', () => {
    const store = createEntityStore();
    spawnPlayerAt(store);
    const exporter = createSnapshotExportSystem();

    const snapWithoutWave = exporter.onTick(0, store, NO_SOURCES);
    expect(snapWithoutWave?.waveProgress).toBeNull();

    exporter.reset();
    const snapWithWave = exporter.onTick(0, store, {
      encounter: null,
      zone: IDLE_ZONE,
      waveProgress: { dispatched: 3, total: 5, alive: 2 },
      weaponHud: null
    });
    expect(snapWithWave?.waveProgress).toEqual({ dispatched: 3, total: 5, alive: 2 });
  });

  it('copies weaponHud into the snapshot when supplied by combat', () => {
    const store = createEntityStore();
    spawnPlayerAt(store);
    const exporter = createSnapshotExportSystem();
    const sourceModifier = { kind: 'pierceBonus' as const, amount: 1 };
    const sourceTimedEffect = {
      kind: 'temporaryOverdrive' as const,
      cooldownMultiplier: 0.5,
      startedAtSimMs: 200,
      expiresAtSimMs: 1200
    };
    const modifiers: WeaponModifier[] = [sourceModifier];
    const timedEffects: WeaponTimedEffectHudSnapshot[] = [sourceTimedEffect];

    const snap = exporter.onTick(0, store, {
      encounter: null,
      zone: IDLE_ZONE,
      waveProgress: null,
      weaponHud: {
        selectedIndex: 1,
        weapons: [
          {
            index: 0,
            weaponArchetypeId: 'pistol',
            cooldownStartedAtSimMs: 0,
            cooldownReadyAtSimMs: 0,
            modifiers: [],
            timedEffects: []
          },
          {
            index: 1,
            weaponArchetypeId: 'shotgun',
            cooldownStartedAtSimMs: 200,
            cooldownReadyAtSimMs: 900,
            modifiers,
            timedEffects
          }
        ]
      }
    });
    sourceModifier.amount = 3;
    sourceTimedEffect.expiresAtSimMs = 2400;
    modifiers.push({ kind: 'projectileSpeedMultiplier', multiplier: 2 });
    timedEffects.length = 0;

    expect(snap?.weaponHud).toEqual({
      selectedIndex: 1,
      weapons: [
        {
          index: 0,
          weaponArchetypeId: 'pistol',
          cooldownStartedAtSimMs: 0,
          cooldownReadyAtSimMs: 0,
          modifiers: [],
          timedEffects: []
        },
        {
          index: 1,
          weaponArchetypeId: 'shotgun',
          cooldownStartedAtSimMs: 200,
          cooldownReadyAtSimMs: 900,
          modifiers: [{ kind: 'pierceBonus', amount: 1 }],
          timedEffects: [
            {
              kind: 'temporaryOverdrive',
              cooldownMultiplier: 0.5,
              startedAtSimMs: 200,
              expiresAtSimMs: 1200
            }
          ]
        }
      ]
    });
  });
});
