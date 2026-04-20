import { describe, expect, it } from 'vitest';

import { SANDBOX_ARENA } from './arenas';
import { buildSessionDefinition } from './buildSession';
import { SLIME_KING } from './bosses';
import { SLIME_FAST, SLIME_TANK, TRAINING_TARGET } from './enemies';
import {
  CAMPAIGN_PRESET,
  SANDBOX_PRESET,
  SANDBOX_WITH_COMBAT_PRESET,
  TRAINING_PRESET
} from './presets';
import { PISTOL } from './weapons';

describe('buildSessionDefinition (sandbox)', () => {
  it('produces a sandbox session with none win/loss conditions', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 42 });

    expect(session.winCondition.kind).toBe('none');
    expect(session.lossCondition.kind).toBe('none');
  });

  it('contains exactly one sandbox encounter that never auto-ends', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 42 });

    expect(session.encounters).toHaveLength(1);
    const encounter = session.encounters[0];
    expect(encounter?.type).toBe('sandbox');
    expect(encounter?.transitionRules.kind).toBe('never');
    expect(encounter?.spawnPlan.kind).toBe('empty');
    expect(encounter?.zoneBehavior.kind).toBe('disabled');
  });

  it('passes through seed and uses default id when not provided', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1234 });

    expect(session.seed).toBe(1234);
    expect(session.id).toBe('sandbox-session');
  });

  it('uses caller-provided id when given', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1, id: 'custom' });

    expect(session.id).toBe('custom');
  });

  it('exposes a positive arena and a player at the centre', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 0 });

    expect(session.arena.width).toBeGreaterThan(0);
    expect(session.arena.height).toBeGreaterThan(0);
    expect(session.player.position).toEqual({ x: 0, y: 0 });
    expect(session.player.maxSpeed).toBeGreaterThan(0);
  });

  it('sandbox keeps loadout null and an empty spawn plan', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 0 });

    expect(session.loadout).toBeNull();
    expect(session.encounters[0]?.spawnPlan.kind).toBe('empty');
  });
});

describe('buildSessionDefinition (sandbox-with-combat)', () => {
  it('produces a sandbox-with-combat session with none win/loss conditions', () => {
    const session = buildSessionDefinition(SANDBOX_WITH_COMBAT_PRESET, { seed: 7 });

    expect(session.winCondition.kind).toBe('none');
    expect(session.lossCondition.kind).toBe('none');
  });

  it('exposes a Loadout that points at the pistol archetype id', () => {
    const session = buildSessionDefinition(SANDBOX_WITH_COMBAT_PRESET, { seed: 7 });

    expect(session.loadout).toEqual({ primaryWeaponArchetypeId: PISTOL.id });
  });

  it('uses a static spawn plan with the training target inside the arena', () => {
    const session = buildSessionDefinition(SANDBOX_WITH_COMBAT_PRESET, { seed: 7 });
    const encounter = session.encounters[0];

    expect(encounter?.type).toBe('sandbox');
    expect(encounter?.transitionRules.kind).toBe('never');

    const plan = encounter?.spawnPlan;
    if (plan?.kind !== 'static') throw new Error('expected static spawn plan');
    expect(plan.spawns).toHaveLength(1);
    expect(plan.spawns[0]?.archetypeId).toBe(TRAINING_TARGET.id);

    const halfW = session.arena.width / 2;
    const halfH = session.arena.height / 2;
    const pos = plan.spawns[0]!.position;
    expect(pos.x).toBeGreaterThan(-halfW);
    expect(pos.x).toBeLessThan(halfW);
    expect(pos.y).toBeGreaterThan(-halfH);
    expect(pos.y).toBeLessThan(halfH);
  });
});

describe('buildSessionDefinition (training)', () => {
  it('uses allEncountersComplete and playerDeath as run-end conditions', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });

    expect(session.winCondition.kind).toBe('allEncountersComplete');
    expect(session.lossCondition.kind).toBe('playerDeath');
  });

  it('produces a wave1 -> break -> wave2 encounter sequence', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });

    expect(session.encounters).toHaveLength(3);
    expect(session.encounters[0]?.type).toBe('wave');
    expect(session.encounters[1]?.type).toBe('break');
    expect(session.encounters[2]?.type).toBe('wave');
  });

  it('every wave is a wave-spawn-plan composed only of known archetypes', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    const knownIds = new Set([SLIME_FAST.id, SLIME_TANK.id]);

    for (const encounter of session.encounters) {
      if (encounter.type !== 'wave') continue;
      const plan = encounter.spawnPlan;
      if (plan.kind !== 'wave') throw new Error('expected wave spawn plan in a wave encounter');
      expect(plan.spawnIntervalMs).toBeGreaterThan(0);
      expect(plan.maxAlive).toBeGreaterThan(0);
      for (const spawn of plan.spawns) {
        expect(knownIds.has(spawn.archetypeId)).toBe(true);
      }
    }
  });

  it('waves shrink the zone, break expands it, and stitches without margin jumps', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    const [wave1, breakEnc, wave2] = session.encounters;
    if (
      wave1?.zoneBehavior.kind !== 'shrinkLinear' ||
      breakEnc?.zoneBehavior.kind !== 'expandLinear' ||
      wave2?.zoneBehavior.kind !== 'shrinkLinear'
    ) {
      throw new Error('expected shrink/expand/shrink zone behaviors');
    }
    expect(breakEnc.zoneBehavior.fromMargin).toBe(wave1.zoneBehavior.toMargin);
    expect(wave2.zoneBehavior.fromMargin).toBe(breakEnc.zoneBehavior.toMargin);
  });

  it('wave shrink finishes within the minimum dispatch budget so margin reaches toMargin', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    for (const encounter of session.encounters) {
      if (encounter.type !== 'wave') continue;
      if (encounter.spawnPlan.kind !== 'wave') continue;
      if (encounter.zoneBehavior.kind !== 'shrinkLinear') continue;
      const minDispatchMs =
        encounter.spawnPlan.spawns.length * encounter.spawnPlan.spawnIntervalMs;
      expect(encounter.zoneBehavior.durationMs).toBeLessThanOrEqual(minDispatchMs);
    }
  });

  it('break uses a timer transition rule', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    const breakEnc = session.encounters[1];

    if (breakEnc?.transitionRules.kind !== 'timer') {
      throw new Error('expected timer transition rule');
    }
    expect(breakEnc.transitionRules.durationMs).toBeGreaterThan(0);
    expect(breakEnc.transitionRules.next).toBe('sequential');
  });

  it('waves use allEnemiesCleared as transition rule', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    for (const encounter of session.encounters) {
      if (encounter.type !== 'wave') continue;
      expect(encounter.transitionRules.kind).toBe('allEnemiesCleared');
      expect(encounter.transitionRules.next).toBe('sequential');
    }
  });

  it('exposes pistol loadout and a damageable training player', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });

    expect(session.loadout).toEqual({ primaryWeaponArchetypeId: PISTOL.id });
    expect(session.player.maxHp).toBeGreaterThan(0);
  });
});

describe('buildSessionDefinition (campaign)', () => {
  it('campaign: three waves with breaks, pre-boss break, then boss with bossDefeated win', () => {
    const session = buildSessionDefinition(CAMPAIGN_PRESET, { seed: 2 });
    expect(session.winCondition).toEqual({ kind: 'bossDefeated' });
    expect(session.lossCondition).toEqual({ kind: 'playerDeath' });
    expect(session.encounters).toHaveLength(7);

    expect(session.encounters[0]?.id).toBe('campaign-wave-1');
    expect(session.encounters[1]?.id).toBe('campaign-break-after-wave-1');
    expect(session.encounters[2]?.id).toBe('campaign-wave-2');
    expect(session.encounters[3]?.id).toBe('campaign-break-after-wave-2');
    expect(session.encounters[4]?.id).toBe('campaign-wave-3');
    expect(session.encounters[5]?.type).toBe('break');
    expect(session.encounters[5]?.id).toBe('campaign-pre-boss-break');

    const bossEnc = session.encounters[6];
    expect(bossEnc?.type).toBe('boss');
    expect(bossEnc?.zoneBehavior).toEqual({ kind: 'disabled' });
    const plan = bossEnc?.spawnPlan;
    expect(plan?.kind).toBe('boss');
    if (plan?.kind !== 'boss') throw new Error('expected boss spawn plan');
    expect(plan.bossArchetypeId).toBe(SLIME_KING.id);
    expect(plan.position.x).toBe(0);
    // top center, same inset as wave edge margin (0.5) + boss radius
    const expectedY = SANDBOX_ARENA.height / 2 - 0.5 - SLIME_KING.radius;
    expect(plan.position.y).toBeCloseTo(expectedY, 5);
  });
});
