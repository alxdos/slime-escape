import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from './buildSession';
import { TRAINING_TARGET } from './enemies';
import { SANDBOX_PRESET, SANDBOX_WITH_COMBAT_PRESET } from './presets';
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
