import { createSimulationClock } from './SimulationClock';
import { createWorld, updateWorld } from './world';
import { assertNever, type MainToSim } from '../shared/protocol';

const world = createWorld();

const clock = createSimulationClock((_dtMs, simTimeMs) => {
  updateWorld(world, simTimeMs);
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
    default:
      assertNever(msg);
  }
});

clock.start();
