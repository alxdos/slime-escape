import { SIM_STEP_MS } from '../shared/timing';

export type ClockTick = (dtMs: number, simTimeMs: number) => void;

export type SimulationClock = Readonly<{
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  simTimeMs(): number;
}>;

export function createSimulationClock(onTick: ClockTick): SimulationClock {
  let paused = false;
  let simTimeMs = 0;
  let lastWallMs = 0;
  let lagMs = 0;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  function pump(): void {
    const now = performance.now();
    if (paused) {
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
    isPaused(): boolean {
      return paused;
    },
    simTimeMs(): number {
      return simTimeMs;
    }
  };
}
