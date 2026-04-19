import { assertNever } from '../shared/protocol';
import type { EncounterDefinition } from '../shared/session';
import type { ZoneMode, ZoneSnapshot } from '../shared/snapshot';
import { SIM_STEP_MS } from '../shared/timing';

export type ZoneSystem = Readonly<{
  onEncounterStart(encounter: EncounterDefinition): void;
  onEncounterEnd(encounter: EncounterDefinition): void;
  onTick(): void;
  zone(): ZoneSnapshot;
}>;

type ZoneState = {
  mode: ZoneMode;
  margin: number;
  elapsedMs: number;
  fromMargin: number;
  toMargin: number;
  durationMs: number;
};

export function createZoneSystem(): ZoneSystem {
  let state: ZoneState = idleState();

  return {
    onEncounterStart(encounter): void {
      const behavior = encounter.zoneBehavior;
      switch (behavior.kind) {
        case 'disabled':
          state = idleState();
          return;
        case 'shrinkLinear':
          state = {
            mode: 'shrink',
            margin: behavior.fromMargin,
            elapsedMs: 0,
            fromMargin: behavior.fromMargin,
            toMargin: behavior.toMargin,
            durationMs: behavior.durationMs
          };
          return;
        case 'expandLinear':
          state = {
            mode: 'expand',
            margin: behavior.fromMargin,
            elapsedMs: 0,
            fromMargin: behavior.fromMargin,
            toMargin: behavior.toMargin,
            durationMs: behavior.durationMs
          };
          return;
        default:
          assertNever(behavior);
      }
    },
    onEncounterEnd(_encounter): void {
      state = idleState();
    },
    onTick(): void {
      if (state.mode === 'disabled') return;
      state.elapsedMs += SIM_STEP_MS;
      const t = Math.min(1, Math.max(0, state.elapsedMs / state.durationMs));
      state.margin = state.fromMargin + (state.toMargin - state.fromMargin) * t;
    },
    zone(): ZoneSnapshot {
      return { mode: state.mode, margin: state.margin };
    }
  };
}

function idleState(): ZoneState {
  return {
    mode: 'disabled',
    margin: 0,
    elapsedMs: 0,
    fromMargin: 0,
    toMargin: 0,
    durationMs: 1
  };
}
