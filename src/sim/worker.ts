import { log } from '../shared/log';
import { assertNever, type MainToSim, type SimToMain } from '../shared/protocol';

import { createSessionFlowSystem } from './SessionFlowSystem';
import { createSimulationClock } from './SimulationClock';
import { createSnapshotExportSystem } from './SnapshotExportSystem';
import { createWorld, resetWorld, updateWorld } from './world';

const world = createWorld();
const exporter = createSnapshotExportSystem();

function postToMain(msg: SimToMain): void {
  self.postMessage(msg);
}

const clock = createSimulationClock((_dtMs, simTimeMs) => {
  updateWorld(world, simTimeMs);
  const snapshot = exporter.onTick(simTimeMs, world);
  if (snapshot !== null) {
    postToMain({ kind: 'snapshot', snapshot });
  }
});

const sessionFlow = createSessionFlowSystem({
  clock,
  emitEvent(event) {
    postToMain({ kind: 'event', event });
  },
  onSessionStart() {
    resetWorld(world);
    exporter.reset();
  },
  onSessionStop() {
    resetWorld(world);
    exporter.reset();
  }
});

self.addEventListener('message', (event: MessageEvent<MainToSim>) => {
  const msg = event.data;
  switch (msg.kind) {
    case 'startSession':
      sessionFlow.start(msg.session);
      return;
    case 'stopSession':
      sessionFlow.stop();
      return;
    case 'pause':
      sessionFlow.pause();
      return;
    case 'resume':
      sessionFlow.resume();
      return;
    case 'input':
      sessionFlow.handleInput(msg.command);
      return;
    case 'debug':
      log.warn('debug command received but not implemented', { command: msg.command });
      return;
    default:
      assertNever(msg);
  }
});

clock.start();
