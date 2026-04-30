import { log } from '../shared/log';
import { assertNever, type MainToSim, type SimToMain } from '../shared/protocol';
import { createSimulationCore } from '../shared/sim/SimulationCore';
import { SIM_STEP_MS } from '../shared/timing';

function postToMain(msg: SimToMain): void {
  self.postMessage(msg);
}

const core = createSimulationCore({
  onSnapshot(snapshot) {
    postToMain({ kind: 'snapshot', snapshot });
  },
  onEvent(event) {
    postToMain({ kind: 'event', event });
  }
});

self.addEventListener('message', (event: MessageEvent<MainToSim>) => {
  const msg = event.data;
  switch (msg.kind) {
    case 'startSession':
      core.start(msg.session);
      return;
    case 'stopSession':
      core.stop();
      return;
    case 'pause':
      core.pause();
      return;
    case 'resume':
      core.resume();
      return;
    case 'input':
      core.submitInput(msg.command);
      return;
    case 'debug':
      log.warn('debug command received but not implemented', { command: msg.command });
      return;
    default:
      assertNever(msg);
  }
});

setInterval(() => core.pump(performance.now()), SIM_STEP_MS);
