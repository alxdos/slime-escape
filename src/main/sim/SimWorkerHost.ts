import { assertNever, type MainToSim, type SimToMain } from '../../shared/protocol';
import type { Snapshot } from '../../shared/snapshot';

export type SnapshotPair = Readonly<{
  prev: Snapshot | null;
  curr: Snapshot | null;
  currReceivedAtMs: number;
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

  const pair: { prev: Snapshot | null; curr: Snapshot | null; currReceivedAtMs: number } = {
    prev: null,
    curr: null,
    currReceivedAtMs: 0
  };

  worker.addEventListener('message', (event: MessageEvent<SimToMain>) => {
    const msg = event.data;
    switch (msg.kind) {
      case 'snapshot':
        pair.prev = pair.curr;
        pair.curr = msg.snapshot;
        pair.currReceivedAtMs = performance.now();
        return;
    }
    assertNever(msg.kind);
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
      send({ kind: 'pause' });
    },
    resume(): void {
      send({ kind: 'resume' });
    },
    snapshotPair(): SnapshotPair {
      return pair;
    },
    dispose(): void {
      worker.terminate();
    }
  };
}
