import { describe, expect, it, vi } from 'vitest';

import { DROP_ARCHETYPES, HEAL_ORB } from '../shared/content/drops';
import type { EnemyArchetype } from '../shared/content/enemies';
import type { RuntimeEvent } from '../shared/events';
import { createRng, type Rng } from '../shared/rng';
import { SIM_STEP_MS } from '../shared/timing';

import type { DamageIntent } from './CombatSystem';
import { createDropSystem } from './DropSystem';
import { createEntityStore, type EntityId } from './EntityStore';
import { createHealthDeathSystem, type DeathContext } from './HealthDeathSystem';

function squareContactBox(radius: number) {
  return { width: radius * 2, height: radius * 2 };
}

const PLAYER_SPEC = {
  position: { x: 0, y: 0 },
  radius: 0.5,
  contactBox: squareContactBox(0.5),
  maxSpeed: 6,
  maxHp: 5
};
const NO_DROP_TEST_ENEMY: EnemyArchetype = {
  id: 'test-no-drop-enemy',
  displayName: 'Test No Drop Enemy',
  radius: 0.6,
  contactBox: squareContactBox(0.6),
  maxHp: 3,
  behavior: 'stationary',
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766,
  dropTable: []
};
const LIGHT_DROPPER: EnemyArchetype = {
  ...NO_DROP_TEST_ENEMY,
  id: 'test-light-dropper',
  displayName: 'Test Light Dropper',
  radius: 0.4,
  contactBox: squareContactBox(0.4),
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  dropTable: [{ archetypeId: HEAL_ORB.id, chance: 0.25 }]
};
const HEAVY_DROPPER: EnemyArchetype = {
  ...NO_DROP_TEST_ENEMY,
  id: 'test-heavy-dropper',
  displayName: 'Test Heavy Dropper',
  radius: 0.65,
  contactBox: squareContactBox(0.65),
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 1.7,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 220,
  dropTable: [{ archetypeId: HEAL_ORB.id, chance: 0.55 }]
};
const REGISTRY: Readonly<Record<string, EnemyArchetype>> = {
  [NO_DROP_TEST_ENEMY.id]: NO_DROP_TEST_ENEMY,
  [LIGHT_DROPPER.id]: LIGHT_DROPPER,
  [HEAVY_DROPPER.id]: HEAVY_DROPPER
};

// Enemy archetype with chance:1 for guaranteed-drop tests; keeps the rest of
// the tests independent from concrete mulberry32 values for any single seed.
const GUARANTEED_DROPPER: EnemyArchetype = {
  ...HEAVY_DROPPER,
  id: 'test-guaranteed-dropper',
  dropTable: [{ archetypeId: HEAL_ORB.id, chance: 1 }]
};
const REGISTRY_WITH_GUARANTEED: Readonly<Record<string, EnemyArchetype>> = {
  ...REGISTRY,
  [GUARANTEED_DROPPER.id]: GUARANTEED_DROPPER
};

function spyRng(seed = 1): { rng: Rng; floatCalls: number } {
  const inner = createRng(seed);
  const stats = { floatCalls: 0 };
  const rng: Rng = {
    nextUint32: () => inner.nextUint32(),
    nextFloat: () => {
      stats.floatCalls += 1;
      return inner.nextFloat();
    },
    nextInt: (n) => inner.nextInt(n),
    nextRange: (a, b) => inner.nextRange(a, b)
  };
  return {
    rng,
    get floatCalls(): number {
      return stats.floatCalls;
    }
  } as { rng: Rng; floatCalls: number };
}

function makeDeathContext(opts: {
  entityId: number;
  archetypeId: string | null;
  position: { x: number; y: number };
  simTime: number;
  entityKind?: 'enemy' | 'player';
}): DeathContext {
  return {
    entityId: opts.entityId as EntityId,
    entityKind: opts.entityKind ?? 'enemy',
    archetypeId: opts.archetypeId,
    position: opts.position,
    cause: { kind: 'projectile', projectileId: 0 as EntityId, ownerKind: 'player', weaponArchetypeId: 'pistol' },
    simTime: opts.simTime
  };
}

describe('DropSystem death hook (RNG discipline)', () => {
  it('does not consume RNG when the dropTable is empty', () => {
    const store = createEntityStore();
    const drops = createDropSystem(REGISTRY);
    const spy = spyRng(42);
    drops.setRng(spy.rng);

    const events: RuntimeEvent[] = [];
    drops.onDeathHook(
      makeDeathContext({
        entityId: 7,
        archetypeId: NO_DROP_TEST_ENEMY.id,
        position: { x: 1, y: 2 },
        simTime: 100
      }),
      store,
      (e) => events.push(e)
    );

    expect(spy.floatCalls).toBe(0);
    expect(store.dropCount()).toBe(0);
    expect(events).toHaveLength(0);
  });

  it('consumes exactly one nextFloat per non-empty dropTable death', () => {
    const store = createEntityStore();
    const drops = createDropSystem(REGISTRY);
    const spy = spyRng(42);
    drops.setRng(spy.rng);

    const events: RuntimeEvent[] = [];
    drops.onDeathHook(
      makeDeathContext({
        entityId: 8,
        archetypeId: HEAVY_DROPPER.id,
        position: { x: 3, y: -1 },
        simTime: 200
      }),
      store,
      (e) => events.push(e)
    );

    expect(spy.floatCalls).toBe(1);
  });

  it('throws if rng was not provided', () => {
    const store = createEntityStore();
    const drops = createDropSystem(REGISTRY);
    expect(() =>
      drops.onDeathHook(
        makeDeathContext({
          entityId: 1,
          archetypeId: LIGHT_DROPPER.id,
          position: { x: 0, y: 0 },
          simTime: 0
        }),
        store,
        () => {}
      )
    ).toThrow(/Rng/);
  });

  it('ignores death events for non-enemy entities', () => {
    const store = createEntityStore();
    const drops = createDropSystem(REGISTRY);
    const spy = spyRng(42);
    drops.setRng(spy.rng);

    drops.onDeathHook(
      makeDeathContext({
        entityId: 1,
        archetypeId: null,
        position: { x: 0, y: 0 },
        simTime: 0,
        entityKind: 'player'
      }),
      store,
      () => {}
    );

    expect(spy.floatCalls).toBe(0);
    expect(store.dropCount()).toBe(0);
  });
});

describe('DropSystem death hook (spawn semantics)', () => {
  it('spawns drop at the death position with expireAtSimMs = simTime + ttlMs', () => {
    const store = createEntityStore();
    const drops = createDropSystem(REGISTRY_WITH_GUARANTEED);
    drops.setRng(createRng(1));

    const events: RuntimeEvent[] = [];
    drops.onDeathHook(
      makeDeathContext({
        entityId: 1,
        archetypeId: GUARANTEED_DROPPER.id,
        position: { x: 4.25, y: -2.5 },
        simTime: 1234
      }),
      store,
      (e) => events.push(e)
    );

    expect(store.dropCount()).toBe(1);
    const drop = [...store.drops()][0]!;
    expect(drop.position).toEqual({ x: 4.25, y: -2.5 });
    expect(drop.expireAtSimMs).toBe(1234 + HEAL_ORB.ttlMs);
    expect(drop.archetypeId).toBe(HEAL_ORB.id);

    expect(events.filter((e) => e.kind === 'dropSpawn')).toHaveLength(1);
    const dropSpawn = events.find((e) => e.kind === 'dropSpawn');
    if (dropSpawn?.kind !== 'dropSpawn') throw new Error('expected dropSpawn');
    expect(dropSpawn.entityId).toBe(drop.id);
    expect(dropSpawn.archetypeId).toBe(HEAL_ORB.id);
    expect(dropSpawn.x).toBe(4.25);
    expect(dropSpawn.y).toBe(-2.5);
    expect(dropSpawn.simTime).toBe(1234);
  });

  it('produces identical drop sequences for the same seed and identical death sequences', () => {
    // We mix one guaranteed dropper and two probabilistic droppers so the RNG
    // does drive at least some of the picks; the assertion is on equality of
    // two runs with the same seed, never on a concrete drop count.
    function runSequence(seed: number): Array<{ id: string; x: number; y: number }> {
      const store = createEntityStore();
      const drops = createDropSystem(REGISTRY_WITH_GUARANTEED);
      drops.setRng(createRng(seed));
      const deaths: Array<{ archetypeId: string; position: { x: number; y: number } }> = [
        { archetypeId: LIGHT_DROPPER.id, position: { x: 1, y: 1 } },
        { archetypeId: GUARANTEED_DROPPER.id, position: { x: -2, y: 3 } },
        { archetypeId: HEAVY_DROPPER.id, position: { x: 0, y: -4 } },
        { archetypeId: LIGHT_DROPPER.id, position: { x: 5, y: 5 } },
        { archetypeId: GUARANTEED_DROPPER.id, position: { x: -3, y: -1 } }
      ];
      let nextEntity = 100;
      for (let i = 0; i < deaths.length; i += 1) {
        nextEntity += 1;
        const death = deaths[i]!;
        drops.onDeathHook(
          makeDeathContext({
            entityId: nextEntity,
            archetypeId: death.archetypeId,
            position: death.position,
            simTime: 100 * i
          }),
          store,
          () => {}
        );
      }
      return [...store.drops()].map((d) => ({
        id: d.archetypeId,
        x: d.position.x,
        y: d.position.y
      }));
    }

    const a = runSequence(98765);
    const b = runSequence(98765);
    expect(b).toEqual(a);
    // GUARANTEED_DROPPER fires twice, so at least two drops exist regardless of seed.
    expect(a.length).toBeGreaterThanOrEqual(2);
  });
});

describe('DropSystem tick (ttl, pickup, heal)', () => {
  function setupWorldWithDrop(opts: {
    playerHp?: number;
    playerMaxHp?: number;
    dropPosition?: { x: number; y: number };
    dropExpireAtSimMs?: number;
  } = {}) {
    const store = createEntityStore();
    const player = store.spawnPlayer({
      ...PLAYER_SPEC,
      maxHp: opts.playerMaxHp ?? 5
    });
    if (opts.playerHp !== undefined) player.hp = opts.playerHp;
    const drop = store.spawnDrop({
      archetypeId: HEAL_ORB.id,
      position: opts.dropPosition ?? { x: 5, y: 0 },
      radius: HEAL_ORB.radius,
      effect: HEAL_ORB.effect,
      color: HEAL_ORB.color,
      expireAtSimMs: opts.dropExpireAtSimMs ?? 10_000
    });
    const drops = createDropSystem(REGISTRY, DROP_ARCHETYPES);
    drops.setRng(createRng(1));
    return { store, player, drop, drops };
  }

  it('emits dropExpire and removes the drop when simTime reaches expireAtSimMs', () => {
    const { store, drops, drop } = setupWorldWithDrop({
      dropPosition: { x: 5, y: 0 },
      dropExpireAtSimMs: 500
    });

    const events: RuntimeEvent[] = [];
    drops.tick(500, store, (e) => events.push(e));

    expect(events.map((e) => e.kind)).toEqual(['dropExpire']);
    const expire = events[0];
    if (expire?.kind !== 'dropExpire') throw new Error('expected dropExpire');
    expect(expire.entityId).toBe(drop.id);
    expect(store.dropCount()).toBe(0);
  });

  it('overlap with player applies heal, emits dropPickup and removes the drop in one tick', () => {
    const { store, player, drop, drops } = setupWorldWithDrop({
      playerHp: 2,
      playerMaxHp: 5,
      dropPosition: { x: 0.4, y: 0 } // player.radius=0.5 + drop.radius=0.35 = 0.85 reach
    });
    const events: RuntimeEvent[] = [];
    drops.tick(1000, store, (e) => events.push(e));

    expect(events.map((e) => e.kind)).toEqual(['dropPickup']);
    const pickup = events[0];
    if (pickup?.kind !== 'dropPickup') throw new Error('expected dropPickup');
    expect(pickup.entityId).toBe(drop.id);
    expect(pickup.pickerId).toBe(player.id);
    expect(player.hp).toBe(3); // 2 + 1 (heal-orb amount)
    expect(store.dropCount()).toBe(0);
  });

  it('heal clamps at player.maxHp', () => {
    const { store, player, drops } = setupWorldWithDrop({
      playerHp: 5,
      playerMaxHp: 5,
      dropPosition: { x: 0.4, y: 0 }
    });
    drops.tick(1000, store, () => {});
    expect(player.hp).toBe(5);
  });

  it('ttl wins over pickup when both fire on the same tick (dropExpire, not dropPickup)', () => {
    const { store, drops } = setupWorldWithDrop({
      playerHp: 1,
      dropPosition: { x: 0.4, y: 0 },
      dropExpireAtSimMs: 500
    });
    const events: RuntimeEvent[] = [];
    drops.tick(500, store, (e) => events.push(e));

    expect(events.map((e) => e.kind)).toEqual(['dropExpire']);
    expect(store.dropCount()).toBe(0);
  });

  it('is a no-op for pickup when player is absent, but ttl still fires', () => {
    const { store, drops } = setupWorldWithDrop({
      dropPosition: { x: 0.4, y: 0 },
      dropExpireAtSimMs: 800
    });
    store.removePlayer();

    const events: RuntimeEvent[] = [];
    drops.tick(0, store, (e) => events.push(e));
    expect(events).toHaveLength(0);
    expect(store.dropCount()).toBe(1);

    drops.tick(800, store, (e) => events.push(e));
    expect(events.map((e) => e.kind)).toEqual(['dropExpire']);
    expect(store.dropCount()).toBe(0);
  });

  it('out-of-reach drop produces no events and stays in the store', () => {
    const { store, drops } = setupWorldWithDrop({
      dropPosition: { x: 5, y: 0 } // way beyond reach 0.85
    });
    const events: RuntimeEvent[] = [];
    drops.tick(1000, store, (e) => events.push(e));
    expect(events).toHaveLength(0);
    expect(store.dropCount()).toBe(1);
  });
});

describe('DropSystem heal does not feed HealthDeathSystem', () => {
  function makeContactIntent(targetId: EntityId, amount: number): DamageIntent {
    return {
      targetId,
      amount,
      source: { kind: 'enemyContact', enemyId: 0 as EntityId },
      hitPosition: { x: 0, y: 0 }
    };
  }

  it('repeated pickups never publish a death event nor invoke a death hook', () => {
    const store = createEntityStore();
    const player = store.spawnPlayer({ ...PLAYER_SPEC, maxHp: 3 });
    player.hp = 1;

    const healthDeath = createHealthDeathSystem();
    const hook = vi.fn();
    healthDeath.registerHook(hook);

    // Drop overlapping the player.
    store.spawnDrop({
      archetypeId: HEAL_ORB.id,
      position: { x: 0, y: 0 },
      radius: HEAL_ORB.radius,
      effect: HEAL_ORB.effect,
      color: HEAL_ORB.color,
      expireAtSimMs: 9999
    });
    const drops = createDropSystem(REGISTRY, DROP_ARCHETYPES);
    drops.setRng(createRng(1));

    const events: RuntimeEvent[] = [];
    drops.tick(0, store, (e) => events.push(e));

    expect(events.filter((e) => e.kind === 'death')).toHaveLength(0);
    expect(hook).not.toHaveBeenCalled();
    expect(player.hp).toBe(2);

    // Sanity: HealthDeathSystem still works for damage in the next tick.
    healthDeath.tick(
      [makeContactIntent(player.id, 5)],
      store,
      SIM_STEP_MS,
      (e) => events.push(e)
    );
    expect(events.filter((e) => e.kind === 'death')).toHaveLength(1);
    expect(hook).toHaveBeenCalledTimes(1);
  });
});
