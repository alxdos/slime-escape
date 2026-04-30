import { describe, expect, it } from 'vitest';

import { PISTOL } from '../content/weapons';
import type { RuntimeEvent } from '../events';
import type { ArenaConfig } from '../session';

import { createCombatSystem } from './CombatSystem';
import { createEntityStore } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createRuntimeInputState } from './RuntimeInputState';
import { createSpatialIndex } from './SpatialIndex';

const ARENA: ArenaConfig = { width: 32, height: 18 };
function squareContactBox(radius: number) {
  return { width: radius * 2, height: radius * 2 };
}

const PLAYER_SPEC = {
  position: { x: 0, y: 0 },
  radius: 0.5,
  contactBox: squareContactBox(0.5),
  maxSpeed: 6,
  maxHp: 1
};
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

describe('combat integration (CombatSystem + HealthDeathSystem)', () => {
  it('chains hit -> damage -> death in a single sim tick', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const healthDeath = createHealthDeathSystem();

    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { weapons: [PISTOL.id], selectedIndex: 0 }, 0);
    const enemy = store.spawnEnemy({
      archetypeId: STATIONARY_TEST_ENEMY.archetypeId,
      position: { x: 0.3, y: 0 },
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

    const input = createRuntimeInputState();
    input.aimWorld.x = 5;
    input.aimWorld.y = 0;
    input.firing = true;

    const events: RuntimeEvent[] = [];
    const intents = combat.tick(input, store, index, 0, ARENA, (e) => events.push(e));
    healthDeath.tick(intents, store, 0, (e) => events.push(e));

    const combatEvents = events
      .map((e) => e.kind)
      .filter((k) => k === 'fire' || k === 'hit' || k === 'death');
    expect(combatEvents).toEqual(['fire', 'hit', 'death']);
    expect(intents).toHaveLength(1);
    expect(intents[0]?.targetId).toBe(enemy.id);
    expect(store.enemyById(enemy.id)).toBeNull();
    expect(store.projectileCount()).toBe(0);
  });
});
