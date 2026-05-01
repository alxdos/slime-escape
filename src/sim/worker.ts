import type { MainToSim, SimToMain } from '../shared/protocol';
import { SIM_STEP_MS } from '../shared/timing';
import { createSimulationWorkerController } from './workerController';

function postToMain(msg: SimToMain): void {
  self.postMessage(msg);
}

const controller = createSimulationWorkerController({
  postToMain
});

self.addEventListener('message', (event: MessageEvent<MainToSim>) => {
  controller.handleMessage(event.data);
});

setInterval(() => controller.pump(performance.now()), SIM_STEP_MS);
