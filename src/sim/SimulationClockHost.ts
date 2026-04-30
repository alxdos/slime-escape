import { SIM_STEP_MS } from '../shared/timing';

export type SimulationPumpTarget = Readonly<{
  pump(nowMs: number): void;
}>;

export type SimulationClockHost = Readonly<{
  start(): void;
  stop(): void;
}>;

export type SimulationClockHostOptions = Readonly<{
  now?: () => number;
}>;

export function createSimulationClockHost(
  target: SimulationPumpTarget,
  options: SimulationClockHostOptions = {}
): SimulationClockHost {
  const now = options.now ?? (() => performance.now());
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  function pump(): void {
    target.pump(now());
  }

  return {
    start(): void {
      if (intervalHandle !== null) return;
      pump();
      intervalHandle = setInterval(pump, SIM_STEP_MS);
    },
    stop(): void {
      if (intervalHandle === null) return;
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };
}
