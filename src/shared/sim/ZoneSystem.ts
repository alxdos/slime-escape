import { assertNever } from '../protocol';
import type { EncounterDefinition } from '../session';
import type { ZoneMode, ZoneSnapshot } from '../snapshot';
import { SIM_STEP_MS } from '../timing';

export type ZoneSystem = Readonly<{
  reset(): void;
  onEncounterStart(encounter: EncounterDefinition): void;
  onEncounterEnd(encounter: EncounterDefinition): void;
  onTick(encounterElapsedMs?: number): void;
  zone(): ZoneSnapshot;
}>;

type ZoneState = {
  mode: ZoneMode;
  margin: number;
  elapsedMs: number;
  fromMargin: number;
  toMargin: number;
  durationMs: number;
  introDurationMs: number;
};

export function createZoneSystem(): ZoneSystem {
  let state: ZoneState = idleState();

  return {
    reset(): void {
      state = idleState();
    },
    onEncounterStart(encounter): void {
      const behavior = encounter.zoneBehavior;
      switch (behavior.kind) {
        case 'disabled':
          state = idleState();
          return;
        case 'shrinkLinear':
          state = activeState(
            'shrink',
            state.margin,
            behavior.toMargin,
            behavior.durationMs,
            encounter.introDurationMs
          );
          return;
        case 'expandLinear':
          state = activeState(
            'expand',
            state.margin,
            behavior.toMargin,
            behavior.durationMs,
            encounter.introDurationMs
          );
          return;
        default:
          assertNever(behavior);
      }
    },
    onEncounterEnd(_encounter): void {
      state = holdState(state.margin);
    },
    onTick(encounterElapsedMs = Number.POSITIVE_INFINITY): void {
      if (state.mode === 'disabled') return;
      if (encounterElapsedMs < state.introDurationMs) return;
      // Sample margin from the time already elapsed before advancing the
      // counter. That way, a snapshot taken right after this tick still
      // reflects EncounterSnapshot.elapsedMs (which the exporter computes
      // as simTime - encounter.startSimMs); on the transition tick where
      // encounter.elapsedMs is 0, margin stays at fromMargin instead of
      // jumping forward by one step.
      const t = Math.min(1, Math.max(0, state.elapsedMs / state.durationMs));
      state.margin = state.fromMargin + (state.toMargin - state.fromMargin) * t;
      state.elapsedMs += SIM_STEP_MS;
    },
    zone(): ZoneSnapshot {
      return { mode: state.mode, margin: state.margin };
    }
  };
}

function activeState(
  mode: Extract<ZoneMode, 'shrink' | 'expand'>,
  fromMargin: number,
  toMargin: number,
  durationMs: number,
  introDurationMs: number
): ZoneState {
  return {
    mode,
    margin: fromMargin,
    elapsedMs: 0,
    fromMargin,
    toMargin,
    durationMs,
    introDurationMs
  };
}

function idleState(): ZoneState {
  return {
    mode: 'disabled',
    margin: 0,
    elapsedMs: 0,
    fromMargin: 0,
    toMargin: 0,
    durationMs: 1,
    introDurationMs: 0
  };
}

function holdState(margin: number): ZoneState {
  return {
    mode: 'disabled',
    margin,
    elapsedMs: 0,
    fromMargin: margin,
    toMargin: margin,
    durationMs: 1,
    introDurationMs: 0
  };
}
