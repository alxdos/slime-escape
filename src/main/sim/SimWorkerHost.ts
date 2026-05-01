import type { RuntimeEvent } from '../../shared/events';
import type { InputCommand } from '../../shared/input';
import {
  assertNever,
  type MainToSim,
  type SimToMain,
  type SimWorkerMode
} from '../../shared/protocol';
import type { SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';

export type SnapshotPair = Readonly<{
  prev: Snapshot | null;
  curr: Snapshot | null;
  currReceivedAtMs: number;
  nowMs: number;
}>;

export type SimWorkerHost = Readonly<{
  startSession(session: SessionDefinition, options?: SimWorkerStartOptions): void;
  stopSession(): void;
  pause(): void;
  resume(): void;
  sendInput(command: InputCommand): void;
  sendSequencedInput(command: InputCommand, inputSequence: number): void;
  acceptAuthoritativeSnapshot(snapshot: Snapshot): void;
  snapshotPair(): SnapshotPair;
  predictedSnapshotPair(): SnapshotPair;
  isPaused(): boolean;
  dispose(): void;
}>;

export type SimWorkerStartOptions =
  | Readonly<{ mode?: Extract<SimWorkerMode, 'local-authoritative'> }>
  | Readonly<{ mode: Extract<SimWorkerMode, 'online-predictor'>; selfPlayerId: string }>;

export type SimWorkerHostOptions = Readonly<{
  onEvent?: (event: RuntimeEvent) => void;
}>;

export function createSimWorkerHost(options: SimWorkerHostOptions = {}): SimWorkerHost {
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
  const predictedPair: {
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
  let nextInputSequence = 1;

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
      case 'predictedSnapshot':
        if (paused) {
          return;
        }
        predictedPair.prev = predictedPair.curr;
        predictedPair.curr = msg.snapshot;
        predictedPair.currReceivedAtMs = performance.now();
        return;
      case 'event':
        options.onEvent?.(msg.event);
        return;
      case 'telemetry':
        // HUD/audio (007/008) will subscribe later.
        return;
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

  function clearPair(): void {
    pair.prev = null;
    pair.curr = null;
    pair.currReceivedAtMs = 0;
  }

  function clearPredictedPair(): void {
    predictedPair.prev = null;
    predictedPair.curr = null;
    predictedPair.currReceivedAtMs = 0;
  }

  return {
    startSession(session, options = {}): void {
      paused = false;
      clearPair();
      clearPredictedPair();
      nextInputSequence = 1;
      if (options.mode === 'online-predictor') {
        send({
          kind: 'startSession',
          session,
          mode: options.mode,
          selfPlayerId: options.selfPlayerId
        });
        return;
      }
      send({ kind: 'startSession', session, mode: options.mode ?? 'local-authoritative' });
    },
    stopSession(): void {
      paused = false;
      clearPair();
      clearPredictedPair();
      send({ kind: 'stopSession' });
    },
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
      predictedPair.currReceivedAtMs += drift;
      paused = false;
      send({ kind: 'resume' });
    },
    sendInput(command): void {
      const inputSequence = nextInputSequence;
      nextInputSequence += 1;
      send({ kind: 'input', command, inputSequence });
    },
    sendSequencedInput(command, inputSequence): void {
      nextInputSequence = Math.max(nextInputSequence, inputSequence + 1);
      send({ kind: 'input', command, inputSequence });
    },
    acceptAuthoritativeSnapshot(snapshot): void {
      send({ kind: 'authoritativeSnapshot', snapshot });
    },
    snapshotPair(): SnapshotPair {
      pair.nowMs = paused ? pauseAnchorMs : performance.now();
      return pair;
    },
    predictedSnapshotPair(): SnapshotPair {
      predictedPair.nowMs = paused ? pauseAnchorMs : performance.now();
      return predictedPair;
    },
    isPaused(): boolean {
      return paused;
    },
    dispose(): void {
      worker.terminate();
    }
  };
}
