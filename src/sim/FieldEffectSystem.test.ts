import { describe, expect, it } from 'vitest';

import { createEntityStore, type EntityId } from './EntityStore';
import { createFieldEffectSystem } from './FieldEffectSystem';
import { createSpatialIndex } from './SpatialIndex';

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

function spawnEnemy(store: ReturnType<typeof createEntityStore>, x: number, y: number) {
  return store.spawnEnemy({
    archetypeId: 'test-enemy',
    position: { x, y },
    radius: 0.5,
    contactBox: squareContactBox(0.5),
    behavior: 'stationary',
    maxHp: 3,
    maxSpeed: 0,
    contactDamage: 0,
    contactCooldownMs: 1,
    knockbackBaseImpulse: 0,
    knockbackVelocityScale: 0,
    knockbackDurationMs: 1,
    color: 0xff7766
  });
}

describe('FieldEffectSystem', () => {
  it('creates damage intents on its apply cadence without mutating hp', () => {
    const store = createEntityStore();
    const enemy = spawnEnemy(store, 0.75, 0);
    const fieldEffect = store.spawnFieldEffect({
      archetypeId: 'acid-puddle',
      ownerId: null,
      ownerKind: null,
      position: { x: 0, y: 0 },
      radius: 1,
      applyEveryMs: 500,
      nextApplySimMs: 100,
      expireAtSimMs: 2000,
      effects: [{ kind: 'damage', amount: 1 }]
    });
    const index = createSpatialIndex();
    index.rebuild(store);
    const system = createFieldEffectSystem();

    expect(system.tick(99, store, index).damageIntents).toEqual([]);
    const result = system.tick(100, store, index);

    expect(result.damageIntents).toEqual([
      {
        targetId: enemy.id,
        amount: 1,
        source: {
          kind: 'fieldEffect',
          fieldEffectId: fieldEffect.id,
          archetypeId: 'acid-puddle'
        },
        hitPosition: { x: enemy.position.x, y: enemy.position.y }
      }
    ]);
    expect(result.actorEffectIntents).toEqual([]);
    expect(enemy.hp).toBe(3);
    expect(fieldEffect.nextApplySimMs).toBe(600);
  });

  it('returns status applications separately from damage intents', () => {
    const store = createEntityStore();
    const enemy = spawnEnemy(store, 0, 0);
    const fieldEffect = store.spawnFieldEffect({
      archetypeId: 'slow-puddle',
      ownerId: null,
      ownerKind: null,
      position: { x: 0, y: 0 },
      radius: 1,
      applyEveryMs: 500,
      nextApplySimMs: 0,
      expireAtSimMs: 2000,
      effects: [
        {
          kind: 'status',
          status: { kind: 'slow', speedMultiplier: 0.5, durationMs: 1000 }
        }
      ]
    });
    const index = createSpatialIndex();
    index.rebuild(store);
    const system = createFieldEffectSystem();

    const result = system.tick(0, store, index);

    expect(result.damageIntents).toEqual([]);
    expect(result.actorEffectIntents).toEqual([
      {
        targetId: enemy.id,
        source: {
          kind: 'fieldEffect',
          fieldEffectId: fieldEffect.id,
          archetypeId: 'slow-puddle'
        },
        application: fieldEffect.effects[0]
      }
    ]);
  });

  it('expires field effects before applying on the expiry tick', () => {
    const store = createEntityStore();
    spawnEnemy(store, 0, 0);
    const fieldEffect = store.spawnFieldEffect({
      archetypeId: 'expired-puddle',
      ownerId: null,
      ownerKind: null,
      position: { x: 0, y: 0 },
      radius: 1,
      applyEveryMs: 500,
      nextApplySimMs: 1000,
      expireAtSimMs: 1000,
      effects: [{ kind: 'damage', amount: 1 }]
    });
    const index = createSpatialIndex();
    index.rebuild(store);
    const system = createFieldEffectSystem();

    const result = system.tick(1000, store, index);

    expect(result.damageIntents).toEqual([]);
    expect(store.fieldEffectById(fieldEffect.id)).toBeNull();
  });

  it('respects owner exclusion and slime friendly-fire rules', () => {
    const store = createEntityStore();
    const owner = spawnEnemy(store, 0, 0);
    const nearbyEnemy = spawnEnemy(store, 0.5, 0);
    const player = store.spawnPlayer(PLAYER_SPEC);
    const fieldEffect = store.spawnFieldEffect({
      archetypeId: 'enemy-puddle',
      ownerId: owner.id,
      ownerKind: 'enemy',
      position: { x: 0, y: 0 },
      radius: 1,
      applyEveryMs: 500,
      nextApplySimMs: 0,
      expireAtSimMs: 1000,
      effects: [{ kind: 'damage', amount: 1 }]
    });
    const index = createSpatialIndex();
    index.rebuild(store);
    const system = createFieldEffectSystem();

    const noFriendlyFire = system.tick(0, store, index);
    expect(noFriendlyFire.damageIntents.map((intent) => intent.targetId)).toEqual([player.id]);

    fieldEffect.nextApplySimMs = 500;
    system.setDamageRules({ slimeFriendlyFire: true });
    const friendlyFire = system.tick(500, store, index);

    expect(friendlyFire.damageIntents.map((intent) => intent.targetId)).toEqual([
      player.id,
      nearbyEnemy.id
    ]);
  });
});
