import { describe, expect, it } from 'vitest';

import { BOSS_SCRAP_KING } from '../shared/content/bosses';
import type { RuntimeEvent } from '../shared/events';

import { createBossPhaseSystem } from './BossPhaseSystem';
import { createEntityStore } from './EntityStore';
import { createSpawnSystem } from './SpawnSystem';

const ARENA = { width: 32, height: 18 };

describe('BossPhaseSystem', () => {
  it('emits bossPhaseChange when HP crosses the first phase exit threshold', () => {
    const store = createEntityStore();
    const spawn = createSpawnSystem();
    spawn.onEncounterStart(
      {
        id: 'boss-only',
        type: 'boss',
        backgroundId: null,
        spawnPlan: {
          kind: 'boss',
          bossArchetypeId: BOSS_SCRAP_KING.id,
          position: { x: 0, y: 0 }
        },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'never', next: 'sequential' },
        tuning: null
      },
      store,
      ARENA
    );

    const boss = [...store.bosses()][0]!;
    expect(boss.phaseId).toBe('crown-intact');

    boss.hp = Math.floor(
      BOSS_SCRAP_KING.maxHp * BOSS_SCRAP_KING.phases[0]!.exitWhenHpFractionAtOrBelow
    );

    const events: RuntimeEvent[] = [];
    const bossPhase = createBossPhaseSystem();
    bossPhase.tick(store, ARENA, 0, (e) => events.push(e));

    expect(boss.phaseId).toBe('desperation');
    expect(events.some((e) => e.kind === 'bossPhaseChange')).toBe(true);
  });
});
