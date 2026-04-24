import { describe, expect, it } from 'vitest';

import { BOSS_SCRAP_KING } from '../shared/content/bosses';
import { TRAINING_PLAYER } from '../shared/content/players';
import { FIREBALL_STAFF } from '../shared/content/weapons';
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

  it('spawns coneBurst as a standard fireball projectile', () => {
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
    store.spawnPlayer({ ...TRAINING_PLAYER, position: { x: 4, y: 0 } });

    const simTimeMs = 1200;
    const events: RuntimeEvent[] = [];
    const bossPhase = createBossPhaseSystem();
    bossPhase.tick(store, ARENA, simTimeMs, (e) => events.push(e));

    const projectile = [...store.projectiles()][0];
    expect(projectile).toBeDefined();
    expect(projectile?.weaponArchetypeId).toBe(FIREBALL_STAFF.id);
    expect(projectile?.ownerKind).toBe('boss');
    expect(projectile?.motionKind).toBe(FIREBALL_STAFF.projectile.motion.kind);
    expect(projectile?.size).toEqual(FIREBALL_STAFF.projectile.size);
    expect(projectile?.hitRadius).toBe(FIREBALL_STAFF.projectile.hitRadius);
    expect(projectile?.impactDamage).toBe(FIREBALL_STAFF.projectile.impactDamage);
    expect(projectile?.knockbackImpulse).toBe(FIREBALL_STAFF.projectile.knockbackImpulse);
    expect(FIREBALL_STAFF.projectile.motion.kind).toBe('linear');
    if (FIREBALL_STAFF.projectile.motion.kind !== 'linear') {
      throw new Error('fireball staff projectile must stay linear for boss coneBurst');
    }
    expect(projectile?.velocity.vx).toBe(FIREBALL_STAFF.projectile.motion.speed);
    expect(projectile?.velocity.vy).toBe(0);
    expect(projectile?.expireAtSimMs).toBe(simTimeMs + FIREBALL_STAFF.projectile.ttlMs);

    const fireEvent = events.find((event) => event.kind === 'fire');
    expect(fireEvent).toMatchObject({
      kind: 'fire',
      ownerKind: 'boss',
      weaponArchetypeId: FIREBALL_STAFF.id,
      dirX: 1,
      dirY: 0
    });
  });
});
