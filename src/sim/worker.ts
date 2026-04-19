import { createSimulationClock } from './SimulationClock';
import { createWorld, updateWorld } from './world';
import { createSnapshotExportSystem } from './SnapshotExportSystem';
import { assertNever, type MainToSim, type SimToMain } from '../shared/protocol';

const world = createWorld();
const exporter = createSnapshotExportSystem();

const clock = createSimulationClock((_dtMs, simTimeMs) => {
  updateWorld(world, simTimeMs);
  const snapshot = exporter.onTick(simTimeMs, world);
  if (snapshot) {
    const msg: SimToMain = { kind: 'snapshot', snapshot };
    self.postMessage(msg);
  }
});

self.addEventListener('message', (event: MessageEvent<MainToSim>) => {
  const msg = event.data;
  switch (msg.kind) {
    case 'pause':
      clock.pause();
      return;
    case 'resume':
      clock.resume();
      return;
    case 'startSession':
    case 'stopSession':
    case 'input':
    case 'debug':
      throw new Error(`MainToSim kind not implemented in story 001: ${msg.kind}`);
    default:
      assertNever(msg);
  }
});

clock.start();
