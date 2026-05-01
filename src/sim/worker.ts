import { log } from '../shared/log';
import { assertNever, type MainToSim, type SimToMain } from '../shared/protocol';
import { createSimulationCore } from '../shared/sim/SimulationCore';
import { SIM_STEP_MS } from '../shared/timing';

let activeLocalPlayerId: string | null = null;

function postToMain(msg: SimToMain): void {
  self.postMessage(msg);
}

const core = createSimulationCore({
  onSnapshot(snapshot) {
    postToMain({ kind: 'snapshot', snapshot });
  },
  onEvent(event) {
    if (event.kind === 'sessionStop') {
      activeLocalPlayerId = null;
    }
    postToMain({ kind: 'event', event });
  }
});

self.addEventListener('message', (event: MessageEvent<MainToSim>) => {
  const msg = event.data;
  switch (msg.kind) {
    case 'startSession':
      if (activeLocalPlayerId !== null) {
        core.start(msg.session);
        return;
      }
      activeLocalPlayerId = msg.session.players[0].id;
      core.start(msg.session);
      return;
    case 'stopSession':
      activeLocalPlayerId = null;
      core.stop();
      return;
    case 'pause':
      core.pause();
      return;
    case 'resume':
      core.resume();
      return;
    case 'input':
      if (activeLocalPlayerId === null) {
        log.warn('input command received before active local player id is known');
        return;
      }
      core.submitInput(activeLocalPlayerId, msg.command, msg.inputSequence);
      return;
    case 'debug':
      log.warn('debug command received but not implemented', { command: msg.command });
      return;
    default:
      assertNever(msg);
  }
});

setInterval(() => core.pump(performance.now()), SIM_STEP_MS);
