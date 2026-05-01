import { log } from '../shared/log';
import { assertNever, type MainToSim, type SimToMain } from '../shared/protocol';
import {
  createOnlinePredictionCore,
  type OnlinePredictionCore,
  type OnlinePredictionCoreOptions
} from '../shared/sim/OnlinePredictionCore';
import {
  createSimulationCore,
  type SimulationCore,
  type SimulationCoreOptions
} from '../shared/sim/SimulationCore';

export type SimulationWorkerControllerOptions = Readonly<{
  postToMain(msg: SimToMain): void;
  createLocalCore?: (options: SimulationCoreOptions) => SimulationCore;
  createPredictionCore?: (options: OnlinePredictionCoreOptions) => OnlinePredictionCore;
}>;

export type SimulationWorkerController = Readonly<{
  handleMessage(msg: MainToSim): void;
  pump(nowMs: number): void;
  mode(): 'idle' | 'local-authoritative' | 'online-predictor';
}>;

type ActiveRuntime =
  | Readonly<{
      mode: 'local-authoritative';
      core: SimulationCore;
      localPlayerId: string | null;
    }>
  | Readonly<{
      mode: 'online-predictor';
      core: OnlinePredictionCore;
    }>;

export function createSimulationWorkerController(
  options: SimulationWorkerControllerOptions
): SimulationWorkerController {
  const createLocalCore = options.createLocalCore ?? createSimulationCore;
  const createPredictionCore = options.createPredictionCore ?? createOnlinePredictionCore;
  let active: ActiveRuntime | null = null;

  function stopActiveRuntime(): void {
    active?.core.stop();
    active = null;
  }

  function startLocalAuthoritative(msg: Extract<MainToSim, { kind: 'startSession' }>): void {
    stopActiveRuntime();
    const core = createLocalCore({
      onSnapshot(snapshot) {
        options.postToMain({ kind: 'snapshot', snapshot });
      },
      onEvent(event) {
        if (event.kind === 'sessionStop' && active?.mode === 'local-authoritative') {
          active = { ...active, localPlayerId: null };
        }
        options.postToMain({ kind: 'event', event });
      }
    });
    active = {
      mode: 'local-authoritative',
      core,
      localPlayerId: msg.session.players[0]?.id ?? null
    };
    core.start(msg.session);
  }

  function startOnlinePredictor(
    msg: Extract<MainToSim, { kind: 'startSession'; mode: 'online-predictor' }>
  ): void {
    stopActiveRuntime();
    const core = createPredictionCore({
      onPredictedSnapshot(snapshot) {
        options.postToMain({ kind: 'predictedSnapshot', snapshot });
      }
    });
    active = {
      mode: 'online-predictor',
      core
    };
    core.start(msg.session, msg.selfPlayerId);
  }

  function submitInput(msg: Extract<MainToSim, { kind: 'input' }>): void {
    if (active === null) {
      log.warn('input command received before active simulation mode is known');
      return;
    }
    if (active.mode === 'online-predictor') {
      active.core.submitInput(msg.command, msg.inputSequence);
      return;
    }
    if (active.localPlayerId === null) {
      log.warn('input command received before active local player id is known');
      return;
    }
    active.core.submitInput(active.localPlayerId, msg.command, msg.inputSequence);
  }

  return {
    handleMessage(msg): void {
      switch (msg.kind) {
        case 'startSession':
          if (msg.mode === 'online-predictor') {
            startOnlinePredictor(msg);
          } else {
            startLocalAuthoritative(msg);
          }
          return;
        case 'stopSession':
          stopActiveRuntime();
          return;
        case 'pause':
          active?.core.pause();
          return;
        case 'resume':
          active?.core.resume();
          return;
        case 'input':
          submitInput(msg);
          return;
        case 'authoritativeSnapshot':
          if (active?.mode !== 'online-predictor') {
            log.warn('authoritative snapshot ignored outside online predictor mode');
            return;
          }
          active.core.receiveAuthoritativeSnapshot(msg.snapshot);
          return;
        case 'debug':
          log.warn('debug command received but not implemented', { command: msg.command });
          return;
        default:
          assertNever(msg);
      }
    },
    pump(nowMs): void {
      active?.core.pump(nowMs);
    },
    mode(): 'idle' | 'local-authoritative' | 'online-predictor' {
      return active?.mode ?? 'idle';
    }
  };
}
