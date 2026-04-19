import { describe, expect, it } from 'vitest';

import { TRAINING_TARGET } from '../shared/content/enemies';
import { PISTOL } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig } from '../shared/session';

import { createCombatSystem } from './CombatSystem';
import { createEntityStore } from './EntityStore';
import { createHealthDeathSystem } from './HealthDeathSystem';
import { createRuntimeInputState } from './RuntimeInputState';
import { createSpatialIndex } from './SpatialIndex';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const PLAYER_SPEC = { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6 };

describe('combat integration (CombatSystem + HealthDeathSystem)', () => {
  it('chains hit -> damage -> death in a single sim tick', () => {
    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const healthDeath = createHealthDeathSystem();

    const player = store.spawnPlayer(PLAYER_SPEC);
    combat.setPlayerLoadout(player.id, { primaryWeaponArchetypeId: PISTOL.id }, 0);
    const enemy = store.spawnEnemy({
      archetypeId: TRAINING_TARGET.id,
      position: { x: 0.3, y: 0 },
      radius: TRAINING_TARGET.radius,
      behavior: 'stationary',
      maxHp: 1,
      color: TRAINING_TARGET.color
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
