import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MainToSim, SimToMain } from '../../shared/protocol';
import type { Snapshot } from '../../shared/snapshot';
import { createSimWorkerHost } from './SimWorkerHost';

describe('createSimWorkerHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resets predicted interpolation only when the worker marks a reconcile snapshot', () => {
    const workers = installFakeWorker();
    let nowMs = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    const host = createSimWorkerHost();
    const worker = workers[0];
    if (worker === undefined) throw new Error('expected worker');
    const authoritative = makeSnapshot({ simTimeMs: 150 });
    const before = makeSnapshot({ simTimeMs: 120 });
    const stalePump = makeSnapshot({ simTimeMs: 140 });
    const reconcile = makeSnapshot({ simTimeMs: 160 });
    const followup = makeSnapshot({ simTimeMs: 176 });

    host.acceptAuthoritativeSnapshot(authoritative, { resetPredictedInterpolation: true });
    expect(worker.posted.at(-1)).toEqual({
      kind: 'authoritativeSnapshot',
      snapshot: authoritative,
      resetPredictedInterpolation: true
    });

    worker.emit({ kind: 'predictedSnapshot', snapshot: before });
    worker.emit({ kind: 'predictedSnapshot', snapshot: stalePump });
    expect(host.predictedSnapshotPair()).toMatchObject({
      prev: before,
      curr: stalePump
    });

    nowMs = 1016;
    worker.emit({ kind: 'predictedSnapshot', snapshot: reconcile, resetInterpolation: true });
    expect(host.predictedSnapshotPair()).toMatchObject({
      prev: null,
      curr: reconcile,
      currReceivedAtMs: 1016
    });

    worker.emit({ kind: 'predictedSnapshot', snapshot: followup });
    expect(host.predictedSnapshotPair()).toMatchObject({
      prev: reconcile,
      curr: followup
    });
  });
});

function installFakeWorker(): FakeWorker[] {
  const workers: FakeWorker[] = [];
  class WorkerHarness {
    private readonly listeners = new Map<string, Array<(event: { data: SimToMain }) => void>>();
    readonly posted: MainToSim[] = [];

    constructor(_url: URL, _options?: WorkerOptions) {
      workers.push(this);
    }

    addEventListener(type: string, listener: (event: { data: SimToMain }) => void): void {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    postMessage(msg: MainToSim): void {
      this.posted.push(msg);
    }

    terminate(): void {}

    emit(msg: SimToMain): void {
      for (const listener of this.listeners.get('message') ?? []) {
        listener({ data: msg });
      }
    }
  }

  type FakeWorker = InstanceType<typeof WorkerHarness>;
  vi.stubGlobal('Worker', WorkerHarness);
  return workers;
}

type FakeWorker = {
  posted: MainToSim[];
  emit(msg: SimToMain): void;
};

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    simTimeMs: 0,
    entities: [],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {},
    ...overrides
  };
}
