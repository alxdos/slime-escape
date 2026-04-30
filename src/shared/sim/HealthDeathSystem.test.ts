import { describe, expect, it, vi } from 'vitest';

import { PISTOL } from '../content/weapons';
import type { RuntimeEvent } from '../events';
import { SIM_STEP_MS } from '../timing';

import type { DamageIntent } from './CombatSystem';
import { createEntityStore, type CompanionSpawnSpec, type EntityId } from './EntityStore';
import {
  createHealthDeathSystem,
  type DamageContext,
  type DeathContext
} from './HealthDeathSystem';

function squareContactBox(radius: number) {
  return { width: radius * 2, height: radius * 2 };
}

const STATIONARY_TEST_ENEMY = {
  archetypeId: 'test-stationary-enemy',
  radius: 0.6,
  contactBox: squareContactBox(0.6),
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766
} as const;
const COMPANION_SPEC: CompanionSpawnSpec = {
  petArchetypeId: 'debug-buddy',
  position: { x: 2, y: 3 },
  contactBox: { width: 0.8, height: 0.8 },
  maxHp: 4,
  movement: { maxSpeed: 8, acceleration: 20, orbitRadius: 2 },
  threat: { acquireRadius: 6, releaseRadius: 8 },
  weaponLoadout: { weapons: [PISTOL.id], selectedIndex: 0 },
  boop: { radius: 0.25, impulse: 4, durationMs: 120, cooldownMs: 500 },
  rescue: { radius: 1, durationMs: SIM_STEP_MS * 3, reviveHpFraction: 0.5 }
};

function makeIntent(targetId: EntityId, amount: number): DamageIntent {
  return {
    targetId,
    amount,
    source: {
      kind: 'projectile',
      projectileId: 0 as EntityId,
      ownerKind: 'player',
      weaponArchetypeId: PISTOL.id,
      impactDirX: 1,
      impactDirY: 0
    },
    hitPosition: { x: 0, y: 0 }
  };
}

function makeContactIntent(enemyId: EntityId, targetId: EntityId, amount: number): DamageIntent {
  return {
    targetId,
    amount,
    source: { kind: 'enemyContact', enemyId },
    hitPosition: { x: 0, y: 0 }
  };
}

function spawnTarget(store: ReturnType<typeof createEntityStore>, hp = 3) {
  return store.spawnEnemy({
    archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
    position: { x: 1, y: 0 },
    radius: STATIONARY_TEST_ENEMY.radius,
    contactBox: STATIONARY_TEST_ENEMY.contactBox,
    behavior: 'stationary',
    maxHp: hp,
    maxSpeed: STATIONARY_TEST_ENEMY.maxSpeed,
    contactDamage: STATIONARY_TEST_ENEMY.contactDamage,
    contactCooldownMs: STATIONARY_TEST_ENEMY.contactCooldownMs,
    knockbackBaseImpulse: STATIONARY_TEST_ENEMY.knockbackBaseImpulse,
    knockbackVelocityScale: STATIONARY_TEST_ENEMY.knockbackVelocityScale,
    knockbackDurationMs: STATIONARY_TEST_ENEMY.knockbackDurationMs,
    color: STATIONARY_TEST_ENEMY.color
  });
}

describe('HealthDeathSystem', () => {
  it('subtracts damage from hp without going negative', () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 3);
    const sys = createHealthDeathSystem();

    sys.tick([makeIntent(enemy.id, 10)], store, 100, () => {});

    expect(enemy.hp).toBe(0);
  });

  it('emits death event before running death hooks, then removes the entity', () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const trace: string[] = [];
    sys.registerHook((ctx) => {
      const stillAlive = store.enemyById(ctx.entityId) !== null;
      trace.push(`hook:alive=${stillAlive}`);
    });

    sys.tick([makeIntent(enemy.id, 1)], store, 200, (event) => {
      trace.push(`event:${event.kind}`);
    });

    expect(trace).toEqual(['event:death', 'hook:alive=true']);
    expect(store.enemyById(enemy.id)).toBeNull();
    expect(store.enemyCount()).toBe(0);
  });

  it('runs hooks in registration order', () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const order: number[] = [];
    sys.registerHook(() => order.push(1));
    sys.registerHook(() => order.push(2));
    sys.registerHook(() => order.push(3));

    sys.tick([makeIntent(enemy.id, 5)], store, 0, () => {});

    expect(order).toEqual([1, 2, 3]);
  });

  it('ignores subsequent intents in the same tick targeting an already-dead entity', () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const hook = vi.fn();
    sys.registerHook(hook);
    const events: RuntimeEvent[] = [];

    sys.tick(
      [makeIntent(enemy.id, 1), makeIntent(enemy.id, 1), makeIntent(enemy.id, 1)],
      store,
      0,
      (e) => events.push(e)
    );

    expect(events.filter((e) => e.kind === 'death')).toHaveLength(1);
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('copies projectile weapon and impact direction into death events', () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const events: RuntimeEvent[] = [];

    sys.tick([makeIntent(enemy.id, 1)], store, 0, (e) => events.push(e));

    const death = events.find((e) => e.kind === 'death');
    if (death?.kind !== 'death') throw new Error('expected death event');
    expect(death.weaponArchetypeId).toBe(PISTOL.id);
    expect(death.impactDirX).toBe(1);
    expect(death.impactDirY).toBe(0);
  });

  it('runs damage hooks before death hooks and before entity removal', () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const trace: string[] = [];
    const damages: DamageContext[] = [];
    sys.registerDamageHook((ctx) => {
      damages.push(ctx);
      trace.push(`damage:alive=${store.enemyById(ctx.targetId) !== null}`);
    });
    sys.registerHook((ctx) => {
      trace.push(`death:alive=${store.enemyById(ctx.entityId) !== null}`);
    });

    sys.tick([makeIntent(enemy.id, 1)], store, 77, () => {});

    expect(trace).toEqual(['damage:alive=true', 'death:alive=true']);
    expect(damages[0]?.targetId).toBe(enemy.id);
    expect(damages[0]?.targetKind).toBe('enemy');
    expect(damages[0]?.simTime).toBe(77);
  });

  it('does not run damage hooks for non-positive damage intents', () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 3);
    const sys = createHealthDeathSystem();
    const hook = vi.fn();
    sys.registerDamageHook(hook);

    sys.tick([makeIntent(enemy.id, 0), makeIntent(enemy.id, -1)], store, 0, () => {});

    expect(hook).not.toHaveBeenCalled();
    expect(enemy.hp).toBe(3);
  });

  it('copies explosion weapon into death events without an impact direction', () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const events: RuntimeEvent[] = [];

    sys.tick(
      [
        {
          targetId: enemy.id,
          amount: 1,
          source: {
            kind: 'explosion',
            projectileId: 0 as EntityId,
            ownerKind: 'player',
            weaponArchetypeId: PISTOL.id
          },
          hitPosition: { x: enemy.position.x, y: enemy.position.y }
        }
      ],
      store,
      0,
      (e) => events.push(e)
    );

    const death = events.find((e) => e.kind === 'death');
    if (death?.kind !== 'death') throw new Error('expected death event');
    expect(death.weaponArchetypeId).toBe(PISTOL.id);
    expect(death.impactDirX).toBeNull();
    expect(death.impactDirY).toBeNull();
  });

  it('ignores intent targeting an unknown id', () => {
    const store = createEntityStore();
    const sys = createHealthDeathSystem();
    const events: RuntimeEvent[] = [];

    sys.tick([makeIntent(999 as EntityId, 5)], store, 0, (e) => events.push(e));

    expect(events).toHaveLength(0);
  });

  it("death context exposes archetypeId, position, cause and simTime", () => {
    const store = createEntityStore();
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const captured: DeathContext[] = [];
    sys.registerHook((ctx) => captured.push(ctx));

    sys.tick([makeIntent(enemy.id, 1)], store, 12345, () => {});

    expect(captured).toHaveLength(1);
    const ctx = captured[0]!;
    expect(ctx.entityKind).toBe('enemy');
    expect(ctx.archetypeId).toBe(STATIONARY_TEST_ENEMY.archetypeId);
    expect(ctx.position).toEqual({ x: 1, y: 0 });
    expect(ctx.cause.kind).toBe('projectile');
    expect(ctx.simTime).toBe(12345);
  });
});

describe('HealthDeathSystem player damage', () => {
  it('applies enemyContact damage to the player and clamps at zero', () => {
    const store = createEntityStore();
    const player = store.spawnPlayer({
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: squareContactBox(0.5),
      maxSpeed: 6,
      maxHp: 5
    });
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();

    sys.tick([makeContactIntent(enemy.id, player.id, 2)], store, 0, () => {});

    expect(player.hp).toBe(3);
  });

  it('emits death event with entityKind "player" and removes the player on hp=0', () => {
    const store = createEntityStore();
    const player = store.spawnPlayer({
      position: { x: 1, y: 2 },
      radius: 0.5,
      contactBox: squareContactBox(0.5),
      maxSpeed: 6,
      maxHp: 1
    });
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const events: RuntimeEvent[] = [];
    const captured: DeathContext[] = [];
    sys.registerHook((ctx) => captured.push(ctx));

    sys.tick([makeContactIntent(enemy.id, player.id, 5)], store, 100, (e) => events.push(e));

    const deaths = events.filter((e) => e.kind === 'death');
    expect(deaths).toHaveLength(1);
    if (deaths[0]?.kind !== 'death') throw new Error('expected death');
    expect(deaths[0].entityKind).toBe('player');
    expect(deaths[0].archetypeId).toBeNull();
    expect(deaths[0].weaponArchetypeId).toBeNull();
    expect(deaths[0].impactDirX).toBeNull();
    expect(deaths[0].impactDirY).toBeNull();
    expect(deaths[0].x).toBe(1);
    expect(deaths[0].y).toBe(2);
    expect(captured).toHaveLength(1);
    expect(store.player()).toBeNull();
  });

  it('ignores repeated intents in the same tick after player death (no double loss)', () => {
    const store = createEntityStore();
    const player = store.spawnPlayer({
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: squareContactBox(0.5),
      maxSpeed: 6,
      maxHp: 1
    });
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const hook = vi.fn();
    sys.registerHook(hook);
    const events: RuntimeEvent[] = [];

    sys.tick(
      [
        makeContactIntent(enemy.id, player.id, 1),
        makeContactIntent(enemy.id, player.id, 1),
        makeContactIntent(enemy.id, player.id, 1)
      ],
      store,
      0,
      (e) => events.push(e)
    );

    expect(events.filter((e) => e.kind === 'death')).toHaveLength(1);
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for intents targeting a removed player on subsequent ticks', () => {
    const store = createEntityStore();
    const player = store.spawnPlayer({
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: squareContactBox(0.5),
      maxSpeed: 6,
      maxHp: 1
    });
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();

    sys.tick([makeContactIntent(enemy.id, player.id, 1)], store, 0, () => {});
    expect(store.player()).toBeNull();

    const events: RuntimeEvent[] = [];
    sys.tick(
      [makeContactIntent(enemy.id, player.id, 1)],
      store,
      SIM_STEP_MS,
      (e) => events.push(e)
    );
    expect(events).toHaveLength(0);
  });
});

describe('HealthDeathSystem companion damage', () => {
  it('applies damage to a companion and reports damage hooks with targetKind companion', () => {
    const store = createEntityStore();
    const companion = store.spawnCompanion(COMPANION_SPEC);
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const damages: DamageContext[] = [];
    sys.registerDamageHook((ctx) => damages.push(ctx));

    sys.tick([makeContactIntent(enemy.id, companion.id, 1)], store, 77, () => {});

    expect(companion.hp).toBe(3);
    expect(companion.state).toBe('alive');
    expect(damages).toHaveLength(1);
    expect(damages[0]?.targetKind).toBe('companion');
    expect(damages[0]?.targetArchetypeId).toBe(COMPANION_SPEC.petArchetypeId);
    expect(damages[0]?.simTime).toBe(77);
  });

  it('turns a defeated companion into a ghost without death hooks or removal', () => {
    const store = createEntityStore();
    const companion = store.spawnCompanion(COMPANION_SPEC);
    const enemy = spawnTarget(store, 1);
    companion.targetId = enemy.id;
    companion.rescueProgressMs = SIM_STEP_MS;
    const sys = createHealthDeathSystem();
    const deathHook = vi.fn();
    const events: RuntimeEvent[] = [];
    sys.registerHook(deathHook);

    sys.tick([makeContactIntent(enemy.id, companion.id, companion.maxHp)], store, 100, (event) =>
      events.push(event)
    );

    expect(companion.hp).toBe(0);
    expect(companion.state).toBe('ghost');
    expect(companion.mode).toBe('ghost');
    expect(companion.targetId).toBeNull();
    expect(companion.rescueProgressMs).toBe(0);
    expect(store.companion()).toBe(companion);
    expect(deathHook).not.toHaveBeenCalled();
    expect(events.filter((event) => event.kind === 'death')).toHaveLength(0);
    const downed = events.find((event) => event.kind === 'companionDowned');
    if (downed?.kind !== 'companionDowned') throw new Error('expected companionDowned');
    expect(downed.companionId).toBe(companion.id);
    expect(downed.petArchetypeId).toBe(COMPANION_SPEC.petArchetypeId);
    expect(downed.weaponArchetypeId).toBeNull();
    expect(downed.impactDirX).toBeNull();
    expect(downed.impactDirY).toBeNull();
    expect(downed.x).toBe(COMPANION_SPEC.position.x);
    expect(downed.y).toBe(COMPANION_SPEC.position.y);
  });

  it('copies projectile metadata into companionDowned events', () => {
    const store = createEntityStore();
    const companion = store.spawnCompanion(COMPANION_SPEC);
    const sys = createHealthDeathSystem();
    const events: RuntimeEvent[] = [];

    sys.tick([makeIntent(companion.id, companion.maxHp)], store, 100, (event) =>
      events.push(event)
    );

    const downed = events.find((event) => event.kind === 'companionDowned');
    if (downed?.kind !== 'companionDowned') throw new Error('expected companionDowned');
    expect(downed.weaponArchetypeId).toBe(PISTOL.id);
    expect(downed.impactDirX).toBe(1);
    expect(downed.impactDirY).toBe(0);
  });

  it('ignores additional same-tick damage after the companion is downed', () => {
    const store = createEntityStore();
    const companion = store.spawnCompanion(COMPANION_SPEC);
    const enemy = spawnTarget(store, 1);
    const sys = createHealthDeathSystem();
    const damages: DamageContext[] = [];
    const events: RuntimeEvent[] = [];
    sys.registerDamageHook((ctx) => damages.push(ctx));

    sys.tick(
      [
        makeContactIntent(enemy.id, companion.id, companion.maxHp),
        makeContactIntent(enemy.id, companion.id, companion.maxHp)
      ],
      store,
      100,
      (event) => events.push(event)
    );

    expect(damages).toHaveLength(1);
    expect(events.filter((event) => event.kind === 'companionDowned')).toHaveLength(1);
  });
});
