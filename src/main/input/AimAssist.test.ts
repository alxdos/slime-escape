import { describe, expect, it } from 'vitest';

import type { AimAssistRule } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';

import { applyAimAssist } from './AimAssist';

const RULE: AimAssistRule = {
  enabled: true,
  maxAngleRadians: Math.PI / 4,
  maxDistance: 8,
  strength: 1
};

function snapshot(entities: Snapshot['entities']): Snapshot {
  return {
    simTimeMs: 0,
    entities,
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {}
  };
}

function player(x: number, y: number): Snapshot['entities'][number] {
  return {
    id: 1,
    kind: 'player',
    playerId: 'player',
    x,
    y,
    hp: 5,
    maxHp: 5,
    state: 'alive',
    formArchetypeId: null,
    weaponHud: null,
    statusEffects: []
  };
}

describe('applyAimAssist', () => {
  it('returns non-aim commands unchanged', () => {
    expect(
      applyAimAssist({ kind: 'fire', phase: 'start' }, RULE, snapshot([]))
    ).toEqual({ kind: 'fire', phase: 'start' });
  });

  it('corrects aim toward the nearest valid target inside angle and distance gates', () => {
    const result = applyAimAssist(
      { kind: 'aim', x: 5, y: 0 },
      RULE,
      snapshot([
        player(0, 0),
        {
          id: 3,
          kind: 'enemy',
          archetypeId: 'target',
          x: 4,
          y: 1,
          hp: 1,
          maxHp: 1
        }
      ])
    );

    expect(result.kind).toBe('aim');
    if (result.kind !== 'aim') throw new Error('expected aim command');
    expect(result.x).toBeCloseTo(5 / Math.sqrt(17) * 4);
    expect(result.y).toBeCloseTo(5 / Math.sqrt(17));
  });

  it('uses deterministic id tie-breakers for equal target candidates', () => {
    const result = applyAimAssist(
      { kind: 'aim', x: 5, y: 0 },
      RULE,
      snapshot([
        player(0, 0),
        {
          id: 8,
          kind: 'enemy',
          archetypeId: 'later',
          x: 4,
          y: 1,
          hp: 1,
          maxHp: 1
        },
        {
          id: 4,
          kind: 'enemy',
          archetypeId: 'earlier',
          x: 4,
          y: -1,
          hp: 1,
          maxHp: 1
        }
      ])
    );

    expect(result.kind).toBe('aim');
    if (result.kind !== 'aim') throw new Error('expected aim command');
    expect(result.x).toBeCloseTo(5 / Math.sqrt(17) * 4);
    expect(result.y).toBeCloseTo(-5 / Math.sqrt(17));
  });

  it('does not correct disabled rules or targets outside the assist cone', () => {
    const snap = snapshot([
      player(0, 0),
      {
        id: 2,
        kind: 'enemy',
        archetypeId: 'outside',
        x: 0,
        y: 4,
        hp: 1,
        maxHp: 1
      }
    ]);

    expect(applyAimAssist({ kind: 'aim', x: 5, y: 0 }, RULE, snap)).toEqual({
      kind: 'aim',
      x: 5,
      y: 0
    });
    expect(
      applyAimAssist({ kind: 'aim', x: 5, y: 0 }, { ...RULE, enabled: false }, snap)
    ).toEqual({ kind: 'aim', x: 5, y: 0 });
  });
});
