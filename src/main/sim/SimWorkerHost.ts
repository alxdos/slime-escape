import type { MainToSim } from '../../shared/protocol';

export type SimWorkerHost = Readonly<{
  pause(): void;
  resume(): void;
  dispose(): void;
}>;

export function createSimWorkerHost(): SimWorkerHost {
  const worker = new Worker(new URL('../../sim/worker.ts', import.meta.url), {
    type: 'module',
    name: 'simulation'
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
    dispose(): void {
      worker.terminate();
    }
  };
}
