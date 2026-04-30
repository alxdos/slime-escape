import { describe, expect, it } from 'vitest';

import { createEntityStore, type EntityId } from './EntityStore';
import { createStatusEffectSystem, resolveMovementSpeedMultiplier } from './StatusEffectSystem';

function squareContactBox(radius: number) {
  return { width: radius * 2, height: radius * 2 };
}

function spawnEnemy(store: ReturnType<typeof createEntityStore>) {
  return store.spawnEnemy({
    archetypeId: 'test-enemy',
    position: { x: 1, y: 0 },
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

const SOURCE = {
  kind: 'fieldEffect' as const,
  fieldEffectId: 99 as EntityId,
  archetypeId: 'test-puddle'
};

describe('StatusEffectSystem', () => {
  it('applies slow status and resolves the strongest multiplier', () => {
    const store = createEntityStore();
    const enemy = spawnEnemy(store);
    const system = createStatusEffectSystem();

    system.apply(
      [
        {
          targetId: enemy.id,
          source: SOURCE,
          application: {
            kind: 'status',
            status: { kind: 'slow', speedMultiplier: 0.75, durationMs: 1000 }
          }
        },
        {
          targetId: enemy.id,
          source: SOURCE,
          application: {
            kind: 'status',
            status: { kind: 'slow', speedMultiplier: 0.4, durationMs: 500 }
          }
        }
      ],
      100,
      store
    );

    expect(resolveMovementSpeedMultiplier(enemy)).toBe(0.4);
    system.tick(700, store);
    expect(resolveMovementSpeedMultiplier(enemy)).toBe(0.75);
  });

  it('ticks burn and poison as statusEffect damage intents without mutating hp', () => {
    const store = createEntityStore();
    const enemy = spawnEnemy(store);
    const system = createStatusEffectSystem();

    system.apply(
      [
        {
          targetId: enemy.id,
          source: SOURCE,
          application: {
            kind: 'status',
            status: { kind: 'burn', damagePerTick: 1, tickEveryMs: 200, durationMs: 1000 }
          }
        },
        {
          targetId: enemy.id,
          source: SOURCE,
          application: {
            kind: 'status',
            status: { kind: 'poison', damagePerTick: 2, tickEveryMs: 300, durationMs: 1000 }
          }
        }
      ],
      0,
      store
    );

    expect(system.tick(199, store)).toEqual([]);
    expect(system.tick(200, store)).toEqual([
      {
        targetId: enemy.id,
        amount: 1,
        source: { kind: 'statusEffect', statusKind: 'burn', sourceEntityId: SOURCE.fieldEffectId },
        hitPosition: { x: enemy.position.x, y: enemy.position.y }
      }
    ]);
    const poisonTick = system.tick(300, store);
    expect(poisonTick).toEqual([
      {
        targetId: enemy.id,
        amount: 2,
        source: {
          kind: 'statusEffect',
          statusKind: 'poison',
          sourceEntityId: SOURCE.fieldEffectId
        },
        hitPosition: { x: enemy.position.x, y: enemy.position.y }
      }
    ]);
    expect(enemy.hp).toBe(3);
  });

  it('expires statuses before ticking on the expiry instant', () => {
    const store = createEntityStore();
    const enemy = spawnEnemy(store);
    const system = createStatusEffectSystem();
    system.apply(
      [
        {
          targetId: enemy.id,
          source: SOURCE,
          application: {
            kind: 'status',
            status: { kind: 'burn', damagePerTick: 1, tickEveryMs: 1000, durationMs: 1000 }
          }
        }
      ],
      0,
      store
    );

    expect(system.tick(1000, store)).toEqual([]);
    expect(enemy.statusEffects).toEqual([]);
  });
});
