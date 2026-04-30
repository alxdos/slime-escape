import { describe, expect, it } from 'vitest';

import { PISTOL } from '../content/weapons';

import type { DamageIntent } from './CombatSystem';
import { createEntityStore, type EntityId, type EnemySpawnSpec } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createRetaliationSystem } from './RetaliationSystem';

const ENEMY: EnemySpawnSpec = {
  archetypeId: 'test-enemy',
  position: { x: 0, y: 0 },
  radius: 0.5,
  contactBox: { width: 1, height: 1 },
  behavior: 'chase',
  retaliation: { enabled: true, durationMs: 750 },
  maxHp: 3,
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 1,
  knockbackDurationMs: 100,
  color: 0x77ff99
};

describe('RetaliationSystem', () => {
  it('records friendly-fire aggro for enabled enemy victims', () => {
    const store = createEntityStore();
    const attacker = store.spawnEnemy({ ...ENEMY, position: { x: -1, y: 0 } });
    const victim = store.spawnEnemy({ ...ENEMY, position: { x: 1, y: 0 } });
    const health = createHealthDeathSystem();
    const retaliation = createRetaliationSystem();
    health.registerDamageHook((ctx) => retaliation.onDamage(ctx, store));

    health.tick([enemyProjectileIntent(victim.id, attacker.id)], store, 100, () => {});

    expect(victim.aggroMemory).toEqual({
      targetId: attacker.id,
      reason: 'friendlyFire',
      expireAtSimMs: 850
    });
  });

  it('ignores player damage and disabled retaliation policies', () => {
    const store = createEntityStore();
    const victim = store.spawnEnemy({
      ...ENEMY,
      retaliation: { enabled: false, durationMs: 0 }
    });
    const health = createHealthDeathSystem();
    const retaliation = createRetaliationSystem();
    health.registerDamageHook((ctx) => retaliation.onDamage(ctx, store));

    health.tick(
      [
        {
          ...enemyProjectileIntent(victim.id, 1 as EntityId),
          source: {
            kind: 'projectile',
            projectileId: 9 as EntityId,
            ownerId: 1 as EntityId,
            ownerKind: 'player',
            weaponArchetypeId: PISTOL.id,
            impactDirX: 1,
            impactDirY: 0
          }
        }
      ],
      store,
      100,
      () => {}
    );

    expect(victim.aggroMemory).toBeNull();
  });
});

function enemyProjectileIntent(targetId: EntityId, ownerId: EntityId): DamageIntent {
  return {
    targetId,
    amount: 1,
    source: {
      kind: 'projectile',
      projectileId: 9 as EntityId,
      ownerId,
      ownerKind: 'enemy',
      weaponArchetypeId: PISTOL.id,
      impactDirX: 1,
      impactDirY: 0
    },
    hitPosition: { x: 0, y: 0 }
  };
}
