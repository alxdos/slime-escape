import { SIM_STEP_MS } from '../timing';

const STEP_EPSILON_MS = 1e-9;

export type ClockTick = (dtMs: number, simTimeMs: number) => void;

export type SimulationClock = Readonly<{
  pump(nowMs: number): void;
  pause(): void;
  resume(): void;
  toRunning(): void;
  toIdle(): void;
  isPaused(): boolean;
  isRunning(): boolean;
  simTimeMs(): number;
}>;

type Mode = 'idle' | 'running';

export function createSimulationClock(onTick: ClockTick): SimulationClock {
  let mode: Mode = 'idle';
  let paused = false;
  let simTimeMs = 0;
  let lastWallMs: number | null = null;
  let lagMs = 0;

  function stabilize(nowMs: number): void {
    lastWallMs = nowMs;
    lagMs = 0;
  }

  function resetElapsedWallTime(): void {
    lastWallMs = null;
    lagMs = 0;
  }

  return {
    pump(nowMs: number): void {
      if (lastWallMs === null) {
        stabilize(nowMs);
        return;
      }

      if (mode === 'idle' || paused) {
        stabilize(nowMs);
        return;
      }

      lagMs += nowMs - lastWallMs;
      lastWallMs = nowMs;
      while (lagMs + STEP_EPSILON_MS >= SIM_STEP_MS) {
        simTimeMs += SIM_STEP_MS;
        onTick(SIM_STEP_MS, simTimeMs);
        lagMs -= SIM_STEP_MS;
        if (Math.abs(lagMs) < STEP_EPSILON_MS) {
          lagMs = 0;
        }
      }
    },
    pause(): void {
      paused = true;
      resetElapsedWallTime();
    },
    resume(): void {
      if (!paused) return;
      paused = false;
      resetElapsedWallTime();
    },
    toRunning(): void {
      if (mode === 'running') return;
      mode = 'running';
      paused = false;
      simTimeMs = 0;
      resetElapsedWallTime();
    },
    toIdle(): void {
      if (mode === 'idle') return;
      mode = 'idle';
      paused = false;
      simTimeMs = 0;
      resetElapsedWallTime();
    },
    isPaused(): boolean {
      return paused;
    },
    isRunning(): boolean {
      return mode === 'running';
    },
    simTimeMs(): number {
      return simTimeMs;
    }
  };
}
