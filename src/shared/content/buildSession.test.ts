import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from './buildSession';
import { SANDBOX_PRESET } from './presets';

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
});
