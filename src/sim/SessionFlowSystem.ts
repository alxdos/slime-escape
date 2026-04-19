import type { RuntimeEvent } from '../shared/events';
import type { InputCommand } from '../shared/input';
import { log } from '../shared/log';
import type { SessionDefinition } from '../shared/session';

import type { SimulationClock } from './SimulationClock';

export type SessionFlowSystem = Readonly<{
  start(session: SessionDefinition): void;
  stop(): void;
  pause(): void;
  resume(): void;
  handleInput(command: InputCommand): void;
  isActive(): boolean;
  activeSession(): SessionDefinition | null;
}>;

export type SessionFlowDeps = Readonly<{
  clock: SimulationClock;
  emitEvent(event: RuntimeEvent): void;
  onSessionStart?(session: SessionDefinition): void;
  onSessionStop?(): void;
}>;

export function createSessionFlowSystem(deps: SessionFlowDeps): SessionFlowSystem {
  const { clock, emitEvent } = deps;
  let session: SessionDefinition | null = null;

  function start(next: SessionDefinition): void {
    if (session !== null) {
      log.warn('startSession ignored: a session is already active', {
        activeId: session.id,
        attemptedId: next.id
      });
      return;
    }
    session = next;
    deps.onSessionStart?.(next);
    clock.toRunning();
    const simTime = clock.simTimeMs();
    emitEvent({ kind: 'sessionStart', simTime });
    if (next.encounters.length > 0) {
      emitEvent({ kind: 'encounterStart', simTime });
    }
  }

  function stop(): void {
    if (session === null) {
      log.warn('stopSession ignored: no active session');
      return;
    }
    const simTime = clock.simTimeMs();
    if (session.encounters.length > 0) {
      emitEvent({ kind: 'encounterEnd', simTime });
    }
    emitEvent({ kind: 'sessionStop', simTime });
    clock.toIdle();
    deps.onSessionStop?.();
    session = null;
  }

  function pause(): void {
    if (session === null) {
      log.warn('pause ignored: no active session');
      return;
    }
    if (clock.isPaused()) return;
    clock.pause();
    emitEvent({ kind: 'pause', simTime: clock.simTimeMs() });
  }

  function resume(): void {
    if (session === null) {
      log.warn('resume ignored: no active session');
      return;
    }
    if (!clock.isPaused()) return;
    clock.resume();
    emitEvent({ kind: 'resume', simTime: clock.simTimeMs() });
  }

  function handleInput(_command: InputCommand): void {
    if (session === null) {
      log.warn('input command ignored: no active session');
      return;
    }
    // T6 wires actual handling onto runtime input state.
  }

  return {
    start,
    stop,
    pause,
    resume,
    handleInput,
    isActive: () => session !== null,
    activeSession: () => session
  };
}
