import { describe, expect, it } from 'vitest';

import type { EncounterDefinition, ZoneBehavior } from '../session';
import { SIM_STEP_MS } from '../timing';

import { createZoneSystem } from './ZoneSystem';

function encounter(zoneBehavior: ZoneBehavior, introDurationMs = 0): EncounterDefinition {
  return {
    id: 'test',
    type: 'wave',
    backgroundId: null,
    introDurationMs,
    name: null,
    text: null,
    spawnPlan: { kind: 'empty' },
    zoneBehavior,
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never', next: 'sequential' },
    tuning: null
  };
}

describe('ZoneSystem', () => {
  it('starts at margin = 0 with mode disabled before any encounter', () => {
    const zone = createZoneSystem();
    expect(zone.zone()).toEqual({ mode: 'disabled', margin: 0 });
  });

  it("zoneBehavior 'disabled' keeps margin = 0 and ignores ticks", () => {
    const zone = createZoneSystem();
    zone.onEncounterStart(encounter({ kind: 'disabled' }));
    for (let i = 0; i < 100; i += 1) zone.onTick();
    expect(zone.zone()).toEqual({ mode: 'disabled', margin: 0 });
  });

  it("'shrinkLinear' interpolates margin linearly from fromMargin to toMargin over durationMs", () => {
    const zone = createZoneSystem();
    const durationMs = SIM_STEP_MS * 10;
    zone.onEncounterStart(
      encounter({ kind: 'shrinkLinear', fromMargin: 0, toMargin: 4, durationMs })
    );
    expect(zone.zone()).toEqual({ mode: 'shrink', margin: 0 });

    zone.onTick();
    expect(zone.zone().margin).toBeCloseTo(0, 10);

    zone.onTick();
    expect(zone.zone().margin).toBeCloseTo(0.4, 10);

    for (let i = 2; i < 6; i += 1) zone.onTick();
    expect(zone.zone().margin).toBeCloseTo(2, 10);

    for (let i = 6; i < 11; i += 1) zone.onTick();
    expect(zone.zone().margin).toBeCloseTo(4, 10);
  });

  it('keeps linear zone motion frozen until encounter intro has finished', () => {
    const zone = createZoneSystem();
    const durationMs = SIM_STEP_MS * 4;
    const introDurationMs = SIM_STEP_MS * 3;
    zone.onEncounterStart(
      encounter({ kind: 'shrinkLinear', fromMargin: 0, toMargin: 4, durationMs }, introDurationMs)
    );

    zone.onTick(0);
    zone.onTick(SIM_STEP_MS * 2);
    expect(zone.zone()).toEqual({ mode: 'shrink', margin: 0 });

    zone.onTick(introDurationMs);
    expect(zone.zone()).toEqual({ mode: 'shrink', margin: 0 });

    zone.onTick(introDurationMs + SIM_STEP_MS);
    expect(zone.zone().margin).toBeCloseTo(1, 10);
  });

  it("'shrinkLinear' clamps at toMargin once durationMs has elapsed", () => {
    const zone = createZoneSystem();
    const durationMs = SIM_STEP_MS * 5;
    zone.onEncounterStart(
      encounter({ kind: 'shrinkLinear', fromMargin: 0, toMargin: 3, durationMs })
    );
    for (let i = 0; i < 20; i += 1) zone.onTick();
    expect(zone.zone()).toEqual({ mode: 'shrink', margin: 3 });
  });

  it('starts a new linear behavior from the current actual margin', () => {
    const zone = createZoneSystem();
    const durationMs = SIM_STEP_MS * 8;
    zone.onEncounterStart(
      encounter({
        kind: 'shrinkLinear',
        fromMargin: 0,
        toMargin: 4,
        durationMs
      })
    );
    for (let i = 0; i < 4; i += 1) zone.onTick();
    const currentMargin = zone.zone().margin;
    expect(currentMargin).toBeGreaterThan(0);
    expect(currentMargin).toBeLessThan(4);

    zone.onEncounterEnd(encounter({ kind: 'disabled' }));
    zone.onEncounterStart(
      encounter({
        kind: 'shrinkLinear',
        fromMargin: 0,
        toMargin: 5,
        durationMs
      })
    );
    expect(zone.zone()).toEqual({ mode: 'shrink', margin: currentMargin });

    zone.onTick();
    expect(zone.zone()).toEqual({ mode: 'shrink', margin: currentMargin });
  });

  it("'expandLinear' interpolates from the current actual margin to toMargin", () => {
    const zone = createZoneSystem();
    const durationMs = SIM_STEP_MS * 4;
    zone.onEncounterStart(
      encounter({ kind: 'shrinkLinear', fromMargin: 0, toMargin: 4, durationMs })
    );
    for (let i = 0; i < 5; i += 1) zone.onTick();
    zone.onEncounterEnd(encounter({ kind: 'disabled' }));
    zone.onEncounterStart(
      encounter({ kind: 'expandLinear', fromMargin: 99, toMargin: 0, durationMs })
    );

    expect(zone.zone()).toEqual({ mode: 'expand', margin: 4 });

    zone.onTick();
    expect(zone.zone().margin).toBeCloseTo(4, 10);

    zone.onTick();
    expect(zone.zone().margin).toBeCloseTo(3, 10);

    for (let i = 0; i < 3; i += 1) zone.onTick();
    expect(zone.zone().margin).toBeCloseTo(0, 10);

    for (let i = 0; i < 5; i += 1) zone.onTick();
    expect(zone.zone()).toEqual({ mode: 'expand', margin: 0 });
  });

  it('onEncounterEnd disables ticks but preserves margin until reset', () => {
    const zone = createZoneSystem();
    zone.onEncounterStart(
      encounter({
        kind: 'shrinkLinear',
        fromMargin: 0,
        toMargin: 4,
        durationMs: SIM_STEP_MS * 4
      })
    );
    for (let i = 0; i < 3; i += 1) zone.onTick();
    expect(zone.zone().margin).toBeGreaterThan(0);

    zone.onEncounterEnd(encounter({ kind: 'disabled' }));
    const heldMargin = zone.zone().margin;
    expect(zone.zone()).toEqual({ mode: 'disabled', margin: heldMargin });

    for (let i = 0; i < 50; i += 1) zone.onTick();
    expect(zone.zone()).toEqual({ mode: 'disabled', margin: heldMargin });

    zone.reset();
    expect(zone.zone()).toEqual({ mode: 'disabled', margin: 0 });
  });

  it('reset clears held margin before a fresh shrink encounter', () => {
    const zone = createZoneSystem();
    const durationMs = SIM_STEP_MS * 5;
    zone.onEncounterStart(
      encounter({ kind: 'shrinkLinear', fromMargin: 0, toMargin: 5, durationMs })
    );
    for (let i = 0; i < 20; i += 1) zone.onTick();
    expect(zone.zone().margin).toBeCloseTo(5, 10);

    zone.onEncounterEnd(encounter({ kind: 'disabled' }));
    zone.reset();
    zone.onEncounterStart(
      encounter({ kind: 'shrinkLinear', fromMargin: 0, toMargin: 5, durationMs })
    );
    expect(zone.zone()).toEqual({ mode: 'shrink', margin: 0 });
  });
});
