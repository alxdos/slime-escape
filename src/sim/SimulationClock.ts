import { SIM_STEP_MS } from '../shared/timing';

export type ClockTick = (dtMs: number, simTimeMs: number) => void;

export type SimulationClock = Readonly<{
  start(): void;
  stop(): void;
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
  let lastWallMs = 0;
  let lagMs = 0;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  function pump(): void {
    const now = performance.now();
    if (mode === 'idle' || paused) {
      lastWallMs = now;
      lagMs = 0;
      return;
    }
    lagMs += now - lastWallMs;
    lastWallMs = now;
    while (lagMs >= SIM_STEP_MS) {
      onTick(SIM_STEP_MS, simTimeMs);
      simTimeMs += SIM_STEP_MS;
      lagMs -= SIM_STEP_MS;
    }
  }

  return {
    start(): void {
      if (intervalHandle !== null) return;
      lastWallMs = performance.now();
      lagMs = 0;
      intervalHandle = setInterval(pump, SIM_STEP_MS);
    },
    stop(): void {
      if (intervalHandle === null) return;
      clearInterval(intervalHandle);
      intervalHandle = null;
    },
    pause(): void {
      paused = true;
    },
    resume(): void {
      if (!paused) return;
      paused = false;
      lastWallMs = performance.now();
      lagMs = 0;
    },
    toRunning(): void {
      if (mode === 'running') return;
      mode = 'running';
      paused = false;
      simTimeMs = 0;
      lastWallMs = performance.now();
      lagMs = 0;
    },
    toIdle(): void {
      if (mode === 'idle') return;
      mode = 'idle';
      paused = false;
      simTimeMs = 0;
      lastWallMs = performance.now();
      lagMs = 0;
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
