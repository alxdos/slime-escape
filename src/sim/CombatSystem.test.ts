import { describe, expect, it } from 'vitest';

import {
  BOMB_PLACER,
  FIREBALL_STAFF,
  PISTOL,
  ROCK_THROWER,
  SHOTGUN,
  SNIPER,
  type WeaponArchetype
} from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createCombatSystem } from './CombatSystem';
import {
  createEntityStore,
  type BossSpawnSpec,
  type EnemySpawnSpec,
  type EntityId,
  type ProjectileSpawnSpec
} from './EntityStore';
import { createRuntimeInputState, type RuntimeInputState } from './RuntimeInputState';
import { createSpatialIndex } from './SpatialIndex';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const PLAYER_SPEC = {
  position: { x: 0, y: 0 },
  radius: 0.5,
  contactBox: { width: 1.2, height: 2 },
  maxSpeed: 6,
  maxHp: 1
};
const STATIONARY_TEST_ENEMY = {
  archetypeId: 'test-stationary-enemy',
  radius: 0.6,
  contactBox: { width: 1.2, height: 1.2 },
  behavior: 'stationary',
  maxHp: 3,
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766
} as const;
const CONTACT_TEST_ENEMY = {
  archetypeId: 'test-contact-enemy',
  radius: 0.4,
  contactBox: { width: 1.4, height: 0.4 },
  behavior: 'chase',
  maxHp: 1,
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99
} as const;
const TEST_BOSS: BossSpawnSpec = {
  archetypeId: 'test-boss',
  position: { x: 0.75, y: 0 },
  radius: 0.8,
  contactBox: { width: 1.6, height: 1.6 },
  maxHp: 10,
  maxSpeed: 0,
  color: 0x99ddff,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 400,
  phaseIndex: 0,
  phaseId: 'test-phase',
  activeAttackIds: [],
  attackIdsFromArchetype: []
};

function pistolProjectileSpawnSpec(
  overrides: Partial<ProjectileSpawnSpec> = {}
): ProjectileSpawnSpec {
  return {
    weaponArchetypeId: PISTOL.id,
    ownerId: 0 as EntityId,
    ownerKind: 'enemy',
    motionKind: 'linear',
    position: { x: 0, y: 0 },
    velocity: { vx: 0, vy: 0 },
    size: PISTOL.projectile.size,
    hitRadius: PISTOL.projectile.hitRadius,
    impactDamage: PISTOL.projectile.impactDamage,
    knockbackImpulse: PISTOL.projectile.knockbackImpulse,
    pierceRemaining: PISTOL.projectile.pierceCount,
    groundOnImpact: PISTOL.projectile.groundOnImpact,
    groundedLifetimeMs: PISTOL.projectile.groundedLifetimeMs,
    explosion: PISTOL.projectile.explosion,
    groundAtSimMs: null,
    expireAtSimMs: 10_000,
    ...overrides
  };
}

function stationaryEnemySpec(position: { x: number; y: number }): EnemySpawnSpec {
  return {
    archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
    position,
    radius: STATIONARY_TEST_ENEMY.radius,
    contactBox: STATIONARY_TEST_ENEMY.contactBox,
    behavior: STATIONARY_TEST_ENEMY.behavior,
    maxHp: STATIONARY_TEST_ENEMY.maxHp,
    maxSpeed: STATIONARY_TEST_ENEMY.maxSpeed,
    contactDamage: STATIONARY_TEST_ENEMY.contactDamage,
    contactCooldownMs: STATIONARY_TEST_ENEMY.contactCooldownMs,
    knockbackBaseImpulse: STATIONARY_TEST_ENEMY.knockbackBaseImpulse,
    knockbackVelocityScale: STATIONARY_TEST_ENEMY.knockbackVelocityScale,
    knockbackDurationMs: STATIONARY_TEST_ENEMY.knockbackDurationMs,
    color: STATIONARY_TEST_ENEMY.color
  };
}

function setupCombat() {
  const store = createEntityStore();
  const index = createSpatialIndex();
  const combat = createCombatSystem();
  const player = store.spawnPlayer(PLAYER_SPEC);
  combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id], selectedIndex: 0 }, 0);
  return { store, index, combat, player };
}

function makeInput(overrides: Partial<RuntimeInputState> = {}): RuntimeInputState {
  const state = createRuntimeInputState();
  if (overrides.moveDir) state.moveDir = overrides.moveDir;
  if (overrides.aimWorld) state.aimWorld = overrides.aimWorld;
  if (overrides.firing !== undefined) state.firing = overrides.firing;
  if (overrides.loadout !== undefined) state.loadout = overrides.loadout;
  return state;
}

describe('CombatSystem', () => {
  it('spawns a projectile and emits fire event when firing with valid aim', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));

    expect(store.projectileCount()).toBe(1);
    const fireEvents = events.filter((e) => e.kind === 'fire');
    expect(fireEvents).toHaveLength(1);
    const ev = fireEvents[0]!;
    if (ev.kind !== 'fire') throw new Error('expected fire event');
    expect(ev.weaponArchetypeId).toBe(PISTOL.id);
    expect(ev.dirX).toBeCloseTo(1);
    expect(ev.dirY).toBeCloseTo(0);
  });

  it('skips firing when aim equals shooter position (zero direction)', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 0, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));

    expect(store.projectileCount()).toBe(0);
    expect(events.filter((e) => e.kind === 'fire')).toHaveLength(0);
  });

  it('respects per-shooter cooldown between consecutive shots', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));
    combat.tick(input, store, index, SIM_STEP_MS, ARENA, (e) => events.push(e));
    combat.tick(input, store, index, PISTOL.cooldownMs - 1, ARENA, (e) => events.push(e));

    expect(events.filter((e) => e.kind === 'fire')).toHaveLength(1);

    combat.tick(input, store, index, PISTOL.cooldownMs, ARENA, (e) => events.push(e));
    expect(events.filter((e) => e.kind === 'fire')).toHaveLength(2);
  });

  it('uses runtime selected slot and keeps cooldowns owner-local per weapon instance', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id, SHOTGUN.id], selectedIndex: 0 }, 0);
    const input = makeInput({
      aimWorld: { x: 5, y: 0 },
      firing: true,
      loadout: { weapons: [PISTOL.id, SHOTGUN.id], selectedIndex: 0 }
    });
    const events: RuntimeEvent[] = [];

    combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));
    expect(store.projectileCount()).toBe(1);

    input.loadout!.selectedIndex = 1;
    combat.tick(input, store, index, SIM_STEP_MS, ARENA, (e) => events.push(e));

    if (SHOTGUN.firePattern.kind !== 'single') throw new Error('expected shotgun single pattern');
    expect(store.projectileCount()).toBe(1 + SHOTGUN.firePattern.count);
    const fireEvents = events.filter((e) => e.kind === 'fire');
    expect(fireEvents.map((e) => (e.kind === 'fire' ? e.weaponArchetypeId : ''))).toEqual([
      PISTOL.id,
      SHOTGUN.id
    ]);
    const shotgunFire = fireEvents[1];
    if (shotgunFire?.kind !== 'fire') throw new Error('expected shotgun fire event');
    expect(shotgunFire.dirX).toBeCloseTo(1);
    expect(shotgunFire.dirY).toBeCloseTo(0);
  });

  it('exposes player weapon HUD state with selected slot and cooldowns', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id, SHOTGUN.id], selectedIndex: 0 }, 0);

    combat.tick(
      makeInput({
        aimWorld: { x: 5, y: 0 },
        firing: true,
        loadout: { weapons: [PISTOL.id, SHOTGUN.id], selectedIndex: 0 }
      }),
      store,
      index,
      0,
      ARENA,
      () => {}
    );

    expect(combat.weaponHudFor(player.id)).toEqual({
      selectedIndex: 0,
      weapons: [
        {
          index: 0,
          weaponArchetypeId: PISTOL.id,
          cooldownReadyAtSimMs: PISTOL.cooldownMs,
          overdriveUntilSimMs: null
        },
        {
          index: 1,
          weaponArchetypeId: SHOTGUN.id,
          cooldownReadyAtSimMs: 0,
          overdriveUntilSimMs: null
        }
      ]
    });
  });

  it('applies size and speed modifiers only to future projectile spawns', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id], selectedIndex: 0 }, 0);
    const input = makeInput({
      aimWorld: { x: 5, y: 0 },
      firing: true,
      loadout: { weapons: [PISTOL.id], selectedIndex: 0 }
    });

    combat.tick(input, store, index, 0, ARENA, () => {});
    expect(combat.addModifierToSelectedWeapon(player.id, {
      kind: 'projectileSizeMultiplier',
      multiplier: 2
    })).toBe(true);
    expect(combat.addModifierToSelectedWeapon(player.id, {
      kind: 'projectileSpeedMultiplier',
      multiplier: 2
    })).toBe(true);
    combat.tick(input, store, index, PISTOL.cooldownMs, ARENA, () => {});

    const projectiles = [...store.projectiles()];
    if (PISTOL.projectile.motion.kind !== 'linear') throw new Error('expected pistol linear motion');
    expect(projectiles).toHaveLength(2);
    expect(projectiles[0]?.size.width).toBeCloseTo(PISTOL.projectile.size.width);
    expect(projectiles[0]?.hitRadius).toBeCloseTo(PISTOL.projectile.hitRadius);
    expect(projectiles[0]?.velocity.vx).toBeCloseTo(PISTOL.projectile.motion.speed);
    expect(projectiles[1]?.size.width).toBeCloseTo(PISTOL.projectile.size.width * 2);
    expect(projectiles[1]?.hitRadius).toBeCloseTo(PISTOL.projectile.hitRadius * 2);
    expect(projectiles[1]?.velocity.vx).toBeCloseTo(PISTOL.projectile.motion.speed * 2);
  });

  it('uses symmetric count and pierce modifiers when spawning future shots', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id], selectedIndex: 0 }, 0);
    combat.addModifierToSelectedWeapon(player.id, {
      kind: 'symmetricProjectileMultiplier',
      multiplier: 2
    });
    combat.addModifierToSelectedWeapon(player.id, { kind: 'pierceBonus', amount: 1 });

    combat.tick(
      makeInput({
        aimWorld: { x: 5, y: 0 },
        firing: true,
        loadout: { weapons: [PISTOL.id], selectedIndex: 0 }
      }),
      store,
      index,
      0,
      ARENA,
      () => {}
    );

    const projectiles = [...store.projectiles()];
    expect(projectiles).toHaveLength(2);
    expect(projectiles.every((p) => p.pierceRemaining === PISTOL.projectile.pierceCount + 1)).toBe(
      true
    );
    expect(projectiles[0]?.velocity.vx).toBeGreaterThan(0);
    expect(projectiles[1]?.velocity.vx).toBeGreaterThan(0);
    expect(projectiles[0]?.velocity.vy).toBeLessThan(0);
    expect(projectiles[1]?.velocity.vy).toBeGreaterThan(0);
    expect(Math.abs(projectiles[0]!.velocity.vy)).toBeCloseTo(
      Math.abs(projectiles[1]!.velocity.vy)
    );
  });

  it('applies arc speed modifiers by shortening flight without changing the landing point', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [ROCK_THROWER.id], selectedIndex: 0 }, 0);
    combat.addModifierToSelectedWeapon(player.id, {
      kind: 'projectileSpeedMultiplier',
      multiplier: 2
    });

    combat.tick(
      makeInput({
        aimWorld: { x: 3, y: 0 },
        firing: true,
        loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 }
      }),
      store,
      index,
      0,
      ARENA,
      () => {}
    );

    const projectile = [...store.projectiles()][0];
    if (projectile === undefined) throw new Error('expected projectile');
    if (ROCK_THROWER.projectile.motion.kind !== 'arc') throw new Error('expected arc motion');
    expect(projectile.arcEnd).toEqual({ x: 3, y: 0 });
    const expectedFlightMs = Math.round(ROCK_THROWER.projectile.motion.flightMs / 2);
    expect(projectile.arcEndSimMs).toBe(expectedFlightMs);
    expect(projectile.velocity.vx).toBeCloseTo(3 / (expectedFlightMs / 1000));
  });

  it('adds fragment explosion modifiers to explosive future shots', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [BOMB_PLACER.id], selectedIndex: 0 }, 0);
    combat.addModifierToSelectedWeapon(player.id, {
      kind: 'fragmentExplosion',
      fragmentWeaponArchetypeId: PISTOL.id,
      count: 4,
      spreadRadians: Math.PI * 2
    });

    combat.tick(
      makeInput({
        aimWorld: { x: 1, y: 0 },
        firing: true,
        loadout: { weapons: [BOMB_PLACER.id], selectedIndex: 0 }
      }),
      store,
      index,
      0,
      ARENA,
      () => {}
    );
    combat.tick(
      makeInput(),
      store,
      index,
      BOMB_PLACER.projectile.explosion!.delayMs,
      ARENA,
      () => {}
    );

    const fragments = [...store.projectiles()];
    expect(fragments).toHaveLength(4);
    expect(fragments.every((p) => p.weaponArchetypeId === PISTOL.id)).toBe(true);
    expect(fragments.every((p) => p.ownerId === player.id)).toBe(true);
  });

  it('uses temporary overdrive for cooldowns while it is active only', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id], selectedIndex: 0 }, 0);
    expect(
      combat.applyTemporaryOverdriveToSelectedWeapon(player.id, 0.5, 100, 0)
    ).toBe(true);
    const input = makeInput({
      aimWorld: { x: 5, y: 0 },
      firing: true,
      loadout: { weapons: [PISTOL.id], selectedIndex: 0 }
    });
    const events: RuntimeEvent[] = [];

    combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));
    expect(combat.weaponHudFor(player.id)?.weapons[0]?.cooldownReadyAtSimMs).toBe(125);
    expect(combat.weaponHudFor(player.id)?.weapons[0]?.overdriveUntilSimMs).toBe(100);
    combat.tick(input, store, index, 124, ARENA, (e) => events.push(e));
    combat.tick(input, store, index, 125, ARENA, (e) => events.push(e));

    expect(events.filter((e) => e.kind === 'fire')).toHaveLength(2);
    expect(combat.weaponHudFor(player.id)?.weapons[0]?.cooldownReadyAtSimMs).toBe(375);
  });

  it('ignores selected-weapon upgrades when the runtime loadout is holstered', () => {
    const store = createEntityStore();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id], selectedIndex: null }, 0);

    expect(
      combat.addModifierToSelectedWeapon(player.id, {
        kind: 'projectileSizeMultiplier',
        multiplier: 2
      })
    ).toBe(false);
    expect(
      combat.applyTemporaryOverdriveToSelectedWeapon(player.id, 0.5, 500, 0)
    ).toBe(false);
  });

  it('does not fire while the runtime loadout is holstered', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id], selectedIndex: null }, 0);
    const input = makeInput({
      aimWorld: { x: 5, y: 0 },
      firing: true,
      loadout: { weapons: [PISTOL.id], selectedIndex: null }
    });

    combat.tick(input, store, index, 0, ARENA, () => {});

    expect(store.projectileCount()).toBe(0);
  });

  it('expands multi-direction fire patterns without requiring aim direction', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [FIREBALL_STAFF.id], selectedIndex: 0 }, 0);
    const input = makeInput({
      aimWorld: { x: player.position.x, y: player.position.y },
      firing: true,
      loadout: { weapons: [FIREBALL_STAFF.id], selectedIndex: 0 }
    });

    combat.tick(input, store, index, 0, ARENA, () => {});

    const projectiles = [...store.projectiles()];
    if (FIREBALL_STAFF.projectile.motion.kind !== 'linear') {
      throw new Error('expected fireball linear motion');
    }
    const speed = Math.round(FIREBALL_STAFF.projectile.motion.speed);
    expect(projectiles).toHaveLength(4);
    expect(projectiles.map((p) => cleanZero(Math.round(p.velocity.vx)))).toEqual([
      speed,
      0,
      -speed,
      0
    ]);
    expect(projectiles.map((p) => cleanZero(Math.round(p.velocity.vy)))).toEqual([
      0,
      speed,
      0,
      -speed
    ]);
  });

  it('moves arc projectiles to their landing point, grounds them, then expires them', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [ROCK_THROWER.id], selectedIndex: 0 }, 0);
    const input = makeInput({
      aimWorld: { x: 3, y: 0 },
      firing: true,
      loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 }
    });

    combat.tick(input, store, index, 0, ARENA, () => {});

    const projectile = [...store.projectiles()][0];
    expect(projectile).toBeDefined();
    if (projectile === undefined) throw new Error('expected projectile');
    expect(projectile.motionKind).toBe('arc');
    expect(projectile.state).toBe('flying');

    if (ROCK_THROWER.projectile.motion.kind !== 'arc') throw new Error('expected arc motion');
    combat.tick(makeInput(), store, index, ROCK_THROWER.projectile.motion.flightMs, ARENA, () => {});

    expect(projectile.state).toBe('grounded');
    expect(projectile.position.x).toBeCloseTo(3);
    expect(projectile.position.y).toBeCloseTo(0);
    expect(projectile.groundAtSimMs).toBe(ROCK_THROWER.projectile.motion.flightMs);

    if (ROCK_THROWER.projectile.groundedLifetimeMs === null) {
      throw new Error('expected grounded lifetime');
    }
    combat.tick(
      makeInput(),
      store,
      index,
      ROCK_THROWER.projectile.motion.flightMs + ROCK_THROWER.projectile.groundedLifetimeMs,
      ARENA,
      () => {}
    );

    expect(store.projectileCount()).toBe(0);
  });

  it('grounds arcing rocks at target impact while keeping impact damage as an intent', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [ROCK_THROWER.id], selectedIndex: 0 }, 0);
    const enemy = store.spawnEnemy(stationaryEnemySpec({ x: 3, y: 0 }));
    const events: RuntimeEvent[] = [];

    combat.tick(
      makeInput({
        aimWorld: { x: 3, y: 0 },
        firing: true,
        loadout: { weapons: [ROCK_THROWER.id], selectedIndex: 0 }
      }),
      store,
      index,
      0,
      ARENA,
      (e) => events.push(e)
    );

    if (ROCK_THROWER.projectile.motion.kind !== 'arc') throw new Error('expected arc motion');
    const intents = combat.tick(
      makeInput(),
      store,
      index,
      ROCK_THROWER.projectile.motion.flightMs,
      ARENA,
      (e) => events.push(e)
    );

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(enemy.id);
    expect(intents[0]?.amount).toBe(ROCK_THROWER.projectile.impactDamage);
    const projectile = [...store.projectiles()][0];
    expect(projectile?.state).toBe('grounded');
    expect(events.filter((e) => e.kind === 'hit')).toHaveLength(1);
  });

  it('lets piercing projectiles hit distinct targets before being removed', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [SNIPER.id], selectedIndex: 0 }, 0);
    const first = store.spawnEnemy(stationaryEnemySpec({ x: 0.75, y: 0 }));
    const second = store.spawnEnemy(stationaryEnemySpec({ x: 1.3, y: 0 }));

    const firstTick = combat.tick(
      makeInput({
        aimWorld: { x: 5, y: 0 },
        firing: true,
        loadout: { weapons: [SNIPER.id], selectedIndex: 0 }
      }),
      store,
      index,
      0,
      ARENA,
      () => {}
    );
    expect(firstTick).toHaveLength(1);
    expect(firstTick[0]?.targetId).toBe(first.id);
    expect(store.projectileCount()).toBe(1);

    const secondTick = combat.tick(makeInput(), store, index, SIM_STEP_MS, ARENA, () => {});
    expect(secondTick).toHaveLength(1);
    expect(secondTick[0]?.targetId).toBe(second.id);
    expect(store.projectileCount()).toBe(0);
  });

  it('uses session damage rules to allow enemy projectiles to hit another enemy', () => {
    const { store, index, combat } = setupCombat();
    combat.setDamageRules({ slimeFriendlyFire: true });
    const owner = store.spawnEnemy(stationaryEnemySpec({ x: -3, y: 0 }));
    const target = store.spawnEnemy(stationaryEnemySpec({ x: 3, y: 0 }));
    store.spawnProjectile(
      pistolProjectileSpawnSpec({
        ownerId: owner.id,
        position: { x: target.position.x, y: target.position.y }
      })
    );

    const intents = combat.tick(makeInput(), store, index, SIM_STEP_MS, ARENA, () => {});

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(target.id);
  });

  it('detonates placed bombs with radial explosion damage and owner filtering', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [BOMB_PLACER.id], selectedIndex: 0 }, 0);
    const enemy = store.spawnEnemy({
      ...stationaryEnemySpec({ x: 1, y: 0 }),
      knockbackVelocityScale: 1
    });
    const events: RuntimeEvent[] = [];

    combat.tick(
      makeInput({
        aimWorld: { x: 1, y: 0 },
        firing: true,
        loadout: { weapons: [BOMB_PLACER.id], selectedIndex: 0 }
      }),
      store,
      index,
      0,
      ARENA,
      (e) => events.push(e)
    );
    expect(store.projectileCount()).toBe(1);

    const intents = combat.tick(
      makeInput(),
      store,
      index,
      BOMB_PLACER.projectile.explosion!.delayMs,
      ARENA,
      (e) => events.push(e)
    );

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(enemy.id);
    expect(intents[0]?.amount).toBe(BOMB_PLACER.projectile.explosion!.damage);
    expect(intents.some((intent) => intent.targetId === player.id)).toBe(false);
    expect(intents[0]?.source.kind).toBe('explosion');
    const explosion = events.find((e) => e.kind === 'explosion');
    if (explosion?.kind !== 'explosion') throw new Error('expected explosion event');
    expect(explosion.weaponArchetypeId).toBe(BOMB_PLACER.id);
    expect(explosion.radius).toBe(BOMB_PLACER.projectile.explosion!.radius);
    expect(enemy.knockback).not.toBeNull();
    expect(store.projectileCount()).toBe(0);
  });

  it('spawns explosion fragments as ordinary owner-inherited projectiles', () => {
    const fragmentBomb: WeaponArchetype = {
      ...BOMB_PLACER,
      id: 'test-fragment-bomb',
      projectile: {
        ...BOMB_PLACER.projectile,
        explosion: {
          delayMs: 0,
          radius: 0,
          damage: 0,
          knockbackImpulse: 0,
          fragments: {
            weaponArchetypeId: PISTOL.id,
            count: 3,
            spreadRadians: Math.PI * 2
          },
          fieldEffect: null,
          effects: []
        }
      }
    };
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem({
      [fragmentBomb.id]: fragmentBomb,
      [PISTOL.id]: PISTOL
    });
    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [fragmentBomb.id], selectedIndex: 0 }, 0);

    const intents = combat.tick(
      makeInput({
        aimWorld: { x: 1, y: 0 },
        firing: true,
        loadout: { weapons: [fragmentBomb.id], selectedIndex: 0 }
      }),
      store,
      index,
      0,
      ARENA,
      () => {}
    );

    expect(intents).toHaveLength(0);
    const fragments = [...store.projectiles()];
    expect(fragments).toHaveLength(3);
    expect(fragments.every((p) => p.weaponArchetypeId === PISTOL.id)).toBe(true);
    expect(fragments.every((p) => p.ownerId === player.id)).toBe(true);
    expect(fragments.every((p) => p.ownerKind === 'player')).toBe(true);
  });

  it('produces a damage intent and hit event when projectile reaches an enemy', () => {
    const { store, index, combat } = setupCombat();
    const enemy = store.spawnEnemy(stationaryEnemySpec({ x: 0.75, y: 0 }));
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });
    const events: RuntimeEvent[] = [];

    const intents = combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(enemy.id);
    expect(intents[0]?.amount).toBe(PISTOL.projectile.impactDamage);
    expect(intents[0]?.source.kind).toBe('projectile');
    if (intents[0]?.source.kind !== 'projectile') throw new Error('expected projectile source');
    expect(intents[0].source.impactDirX).toBeCloseTo(1);
    expect(intents[0].source.impactDirY).toBeCloseTo(0);
    const hitEvents = events.filter((e) => e.kind === 'hit');
    expect(hitEvents).toHaveLength(1);
    const hit = hitEvents[0]!;
    if (hit.kind !== 'hit') throw new Error('expected hit event');
    expect(hit.targetArchetypeId).toBe(STATIONARY_TEST_ENEMY.archetypeId);
    expect(hit.impactDirX).toBeCloseTo(1);
    expect(hit.impactDirY).toBeCloseTo(0);
    expect(enemy.hp).toBe(STATIONARY_TEST_ENEMY.maxHp);
    expect(enemy.knockback).not.toBeNull();
    if (enemy.knockback === null) throw new Error('expected zero projectile knockback');
    expect(enemy.knockback.vx).toBe(0);
    expect(enemy.knockback.vy).toBe(0);
    expect(store.projectileCount()).toBe(0);
  });

  it('applies projectile knockback to enemy using weapon force and target susceptibility', () => {
    const { store, index, combat } = setupCombat();
    const enemy = store.spawnEnemy({
      ...stationaryEnemySpec({ x: 0.75, y: 0 }),
      knockbackVelocityScale: 2,
      knockbackDurationMs: 250
    });
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });

    const intents = combat.tick(input, store, index, 0, ARENA, () => {});

    expect(intents).toHaveLength(1);
    expect(enemy.hp).toBe(STATIONARY_TEST_ENEMY.maxHp);
    expect(enemy.knockback).not.toBeNull();
    if (enemy.knockback === null) throw new Error('expected projectile knockback');
    expect(enemy.knockback.vx).toBeCloseTo(PISTOL.projectile.knockbackImpulse * 2);
    expect(enemy.knockback.vy).toBeCloseTo(0);
    expect(enemy.knockback.startSimMs).toBe(0);
    expect(enemy.knockback.endSimMs).toBe(250);
  });

  it('overwrites active target knockback even when projectile susceptibility is zero', () => {
    const { store, index, combat } = setupCombat();
    const enemy = store.spawnEnemy(stationaryEnemySpec({ x: 0.75, y: 0 }));
    enemy.knockback = { vx: 99, vy: 0, startSimMs: -100, endSimMs: 500 };
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });

    combat.tick(input, store, index, 0, ARENA, () => {});

    expect(enemy.knockback).not.toBeNull();
    if (enemy.knockback === null) throw new Error('expected overwritten knockback');
    expect(enemy.knockback.vx).toBe(0);
    expect(enemy.knockback.vy).toBe(0);
    expect(enemy.knockback.startSimMs).toBe(0);
    expect(enemy.knockback.endSimMs).toBe(STATIONARY_TEST_ENEMY.knockbackDurationMs);
  });

  it('applies projectile knockback to bosses without mutating boss hp', () => {
    const { store, index, combat } = setupCombat();
    const boss = store.spawnBoss(TEST_BOSS);
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });

    const intents = combat.tick(input, store, index, 0, ARENA, () => {});

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(boss.id);
    expect(boss.hp).toBe(TEST_BOSS.maxHp);
    expect(boss.knockback).not.toBeNull();
    if (boss.knockback === null) throw new Error('expected boss projectile knockback');
    expect(boss.knockback.vx).toBeCloseTo(PISTOL.projectile.knockbackImpulse * TEST_BOSS.knockbackVelocityScale);
    expect(boss.knockback.vy).toBeCloseTo(0);
    expect(boss.knockback.endSimMs - boss.knockback.startSimMs).toBe(
      TEST_BOSS.knockbackDurationMs
    );
  });

  it('hits an enemy by contactBox even when the legacy radius would miss', () => {
    const { store, index, combat } = setupCombat();
    const enemy = store.spawnEnemy({
      ...stationaryEnemySpec({ x: 0.85, y: 0 }),
      radius: 0.3,
      contactBox: { width: 1.4, height: 0.4 }
    });
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });

    const intents = combat.tick(input, store, index, 0, ARENA, () => {});

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(enemy.id);
    expect(intents[0]?.source.kind).toBe('projectile');
  });

  it('removes projectiles that exceed ttlMs without producing a damage intent', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 1, y: 0 }, firing: true });
    let simTime = 0;

    combat.tick(input, store, index, simTime, ARENA, () => {});
    expect(store.projectileCount()).toBe(1);

    simTime = PISTOL.projectile.ttlMs;
    const intents = combat.tick(makeInput(), store, index, simTime, ARENA, () => {});

    expect(store.projectileCount()).toBe(0);
    expect(intents).toHaveLength(0);
  });

  it('removes projectiles that leave the arena and never produces a damage intent', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 1000, y: 0 }, firing: true });

    combat.tick(input, store, index, 0, ARENA, () => {});
    expect(store.projectileCount()).toBe(1);

    let simTime = SIM_STEP_MS;
    let intents: ReadonlyArray<unknown> = [];
    while (store.projectileCount() > 0 && simTime < PISTOL.projectile.ttlMs) {
      intents = combat.tick(makeInput(), store, index, simTime, ARENA, () => {});
      simTime += SIM_STEP_MS;
    }

    expect(store.projectileCount()).toBe(0);
    expect(intents).toHaveLength(0);
    expect(simTime).toBeLessThan(PISTOL.projectile.ttlMs);
  });

  it('honours friendly-fire: enemy projectile does not target enemy', () => {
    const { store, index, combat } = setupCombat();
    store.spawnEnemy(stationaryEnemySpec({ x: 0.5, y: 0 }));
    store.spawnProjectile(pistolProjectileSpawnSpec());

    const intents = combat.tick(makeInput(), store, index, SIM_STEP_MS, ARENA, () => {});

    const targetsEnemy = intents.some((i) => {
      const enemy = store.enemyById(i.targetId as EntityId);
      return enemy !== null;
    });
    expect(targetsEnemy).toBe(false);
  });

  it('hits the player by contactBox for enemy projectiles even outside the player radius', () => {
    const { store, index, combat, player } = setupCombat();
    const events: RuntimeEvent[] = [];
    store.spawnProjectile(
      pistolProjectileSpawnSpec({
        position: {
          x: player.position.x + player.contactBox.width / 2 - 0.01,
          y: player.position.y + player.contactBox.height / 2 - 0.08
        }
      })
    );

    const intents = combat.tick(makeInput(), store, index, SIM_STEP_MS, ARENA, (e) =>
      events.push(e)
    );

    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(player.id);
    expect(intents[0]?.source.kind).toBe('projectile');
    if (intents[0]?.source.kind !== 'projectile') throw new Error('expected projectile source');
    expect(intents[0].source.impactDirX).toBeCloseTo(1);
    expect(intents[0].source.impactDirY).toBeCloseTo(0);
    const hit = events.find((e) => e.kind === 'hit');
    if (hit?.kind !== 'hit') throw new Error('expected hit event');
    expect(hit.targetArchetypeId).toBeNull();
    expect(store.projectileCount()).toBe(0);
  });

  it('clear() drops registered loadout so player no longer fires', () => {
    const { store, index, combat } = setupCombat();
    const input = makeInput({ aimWorld: { x: 5, y: 0 }, firing: true });

    combat.clear();
    combat.tick(input, store, index, 0, ARENA, () => {});

    expect(store.projectileCount()).toBe(0);
  });

  it('setPlayerLoadout throws on unknown weapon archetypeId at session start', () => {
    const store = createEntityStore();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(PLAYER_SPEC);

    expect(() =>
      combat.setPlayerLoadout(player.id, { weapons: ['no-such-weapon'], selectedIndex: 0 }, 0)
    ).toThrow(/unknown weapon archetype/);
  });
});

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

describe('CombatSystem contact intents', () => {
  function contactEnemySpec(position: { x: number; y: number }): EnemySpawnSpec {
    return {
      archetypeId: CONTACT_TEST_ENEMY.archetypeId,
      position,
      radius: CONTACT_TEST_ENEMY.radius,
      contactBox: CONTACT_TEST_ENEMY.contactBox,
      behavior: CONTACT_TEST_ENEMY.behavior,
      maxHp: CONTACT_TEST_ENEMY.maxHp,
      maxSpeed: CONTACT_TEST_ENEMY.maxSpeed,
      contactDamage: CONTACT_TEST_ENEMY.contactDamage,
      contactCooldownMs: CONTACT_TEST_ENEMY.contactCooldownMs,
      knockbackBaseImpulse: CONTACT_TEST_ENEMY.knockbackBaseImpulse,
      knockbackVelocityScale: CONTACT_TEST_ENEMY.knockbackVelocityScale,
      knockbackDurationMs: CONTACT_TEST_ENEMY.knockbackDurationMs,
      color: CONTACT_TEST_ENEMY.color
    };
  }

  function setupContact() {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    store.spawnPlayer(PLAYER_SPEC);
    return { store, index, combat };
  }

  it('forms enemyContact DamageIntent for an overlapping enemy with contactDamage > 0', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));

    const intents = combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    expect(intents).toHaveLength(1);
    const intent = intents[0]!;
    expect(intent.targetId).toBe(store.player()!.id);
    expect(intent.amount).toBe(CONTACT_TEST_ENEMY.contactDamage);
    if (intent.source.kind !== 'enemyContact') throw new Error('expected enemyContact source');
    expect(intent.source.enemyId).toBe(enemy.id);
  });

  it('does not emit a runtime event for the contact', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));
    const events: RuntimeEvent[] = [];

    combat.tick(makeInput(), store, index, 0, ARENA, (e) => events.push(e));

    expect(events).toHaveLength(0);
  });

  it('skips contact if cooldown not elapsed and re-fires once it does', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));

    const first = combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    expect(first).toHaveLength(1);

    const mid = combat.tick(
      makeInput(),
      store,
      index,
      CONTACT_TEST_ENEMY.contactCooldownMs - 1,
      ARENA,
      () => {}
    );
    expect(mid).toHaveLength(0);

    const after = combat.tick(
      makeInput(),
      store,
      index,
      CONTACT_TEST_ENEMY.contactCooldownMs,
      ARENA,
      () => {}
    );
    expect(after).toHaveLength(1);
  });

  it('skips enemies with contactDamage === 0', () => {
    const { store, index, combat } = setupContact();
    store.spawnEnemy({
      archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
      position: { x: 0.5, y: 0 },
      radius: STATIONARY_TEST_ENEMY.radius,
      contactBox: STATIONARY_TEST_ENEMY.contactBox,
      behavior: STATIONARY_TEST_ENEMY.behavior,
      maxHp: STATIONARY_TEST_ENEMY.maxHp,
      maxSpeed: STATIONARY_TEST_ENEMY.maxSpeed,
      contactDamage: 0,
      contactCooldownMs: STATIONARY_TEST_ENEMY.contactCooldownMs,
      knockbackBaseImpulse: STATIONARY_TEST_ENEMY.knockbackBaseImpulse,
      knockbackVelocityScale: STATIONARY_TEST_ENEMY.knockbackVelocityScale,
      knockbackDurationMs: STATIONARY_TEST_ENEMY.knockbackDurationMs,
      color: STATIONARY_TEST_ENEMY.color
    });

    const intents = combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    expect(intents).toHaveLength(0);
  });

  it('is a no-op when no player is spawned', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    store.spawnEnemy(contactEnemySpec({ x: 0, y: 0 }));

    expect(() => combat.tick(makeInput(), store, index, 0, ARENA, () => {})).not.toThrow();
  });

  it('knocks the enemy back along (enemy - player) and writes a positive duration', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    expect(enemy.knockback).not.toBeNull();
    if (enemy.knockback === null) throw new Error('unreachable');
    expect(enemy.knockback.vx).toBeGreaterThan(0);
    expect(enemy.knockback.vy).toBeGreaterThan(0);
    expect(enemy.knockback.endSimMs - enemy.knockback.startSimMs).toBe(
      CONTACT_TEST_ENEMY.knockbackDurationMs
    );
  });

  it('with zero approach speed the knockback magnitude equals knockbackBaseImpulse', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));
    store.player()!.velocity.vx = 0;
    store.player()!.velocity.vy = 0;
    enemy.velocity.vx = 0;
    enemy.velocity.vy = 0;

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    if (enemy.knockback === null) throw new Error('expected knockback');
    const speed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    expect(speed).toBeCloseTo(CONTACT_TEST_ENEMY.knockbackBaseImpulse, 10);
  });

  it('approach speed adds knockbackVelocityScale * approach to base impulse', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));
    store.player()!.velocity.vx = 3;
    enemy.velocity.vx = -2;

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});

    if (enemy.knockback === null) throw new Error('expected knockback');
    const speed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    const expected =
      CONTACT_TEST_ENEMY.knockbackBaseImpulse + CONTACT_TEST_ENEMY.knockbackVelocityScale * 4;
    expect(speed).toBeCloseTo(expected, 10);
  });

  it('repeated contact (after cooldown) overwrites knockback rather than summing', () => {
    const { store, index, combat } = setupContact();
    const enemy = store.spawnEnemy(contactEnemySpec({ x: 1.2, y: 0.9 }));

    combat.tick(makeInput(), store, index, 0, ARENA, () => {});
    if (enemy.knockback === null) throw new Error('expected knockback');
    const firstSpeed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);

    combat.tick(makeInput(), store, index, CONTACT_TEST_ENEMY.contactCooldownMs, ARENA, () => {});
    if (enemy.knockback === null) throw new Error('expected knockback');
    const secondSpeed = Math.hypot(enemy.knockback.vx, enemy.knockback.vy);
    expect(secondSpeed).toBeCloseTo(firstSpeed, 10);
    expect(enemy.knockback.startSimMs).toBe(CONTACT_TEST_ENEMY.contactCooldownMs);
  });
});
