import { assertNever, type MainToSim, type SimToMain } from '../../shared/protocol';
import type { Snapshot } from '../../shared/snapshot';

export type SnapshotPair = Readonly<{
  prev: Snapshot | null;
  curr: Snapshot | null;
  currReceivedAtMs: number;
  nowMs: number;
}>;

export type SimWorkerHost = Readonly<{
  pause(): void;
  resume(): void;
  snapshotPair(): SnapshotPair;
  dispose(): void;
}>;

export function createSimWorkerHost(): SimWorkerHost {
  const worker = new Worker(new URL('../../sim/worker.ts', import.meta.url), {
    type: 'module',
    name: 'simulation'
  });

  const pair: {
    prev: Snapshot | null;
    curr: Snapshot | null;
    currReceivedAtMs: number;
    nowMs: number;
  } = {
    prev: null,
    curr: null,
    currReceivedAtMs: 0,
    nowMs: 0
  };

  let paused = false;
  let pauseAnchorMs = 0;

  worker.addEventListener('message', (event: MessageEvent<SimToMain>) => {
    const msg = event.data;
    switch (msg.kind) {
      case 'snapshot':
        if (paused) {
          return;
        }
        pair.prev = pair.curr;
        pair.curr = msg.snapshot;
        pair.currReceivedAtMs = performance.now();
        return;
      case 'event':
      case 'telemetry':
        throw new Error(`SimToMain kind not implemented in story 001: ${msg.kind}`);
      default:
        assertNever(msg);
    }
  });

  worker.addEventListener('error', (event: ErrorEvent) => {
    throw new Error(`simulation worker error: ${event.message}`);
  });

  worker.addEventListener('messageerror', () => {
    throw new Error('simulation worker received unstructured message');
  });

  function send(msg: MainToSim): void {
    worker.postMessage(msg);
  }

  return {
    pause(): void {
      if (paused) return;
      paused = true;
      pauseAnchorMs = performance.now();
      send({ kind: 'pause' });
    },
    resume(): void {
      if (!paused) return;
      const drift = performance.now() - pauseAnchorMs;
      pair.currReceivedAtMs += drift;
      paused = false;
      send({ kind: 'resume' });
    },
    snapshotPair(): SnapshotPair {
      pair.nowMs = paused ? pauseAnchorMs : performance.now();
      return pair;
    },
    dispose(): void {
      worker.terminate();
    }
  };
}
