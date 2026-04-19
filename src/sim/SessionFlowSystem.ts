import type { RuntimeEvent } from '../shared/events';
import type { InputCommand } from '../shared/input';
import { log } from '../shared/log';
import { assertNever } from '../shared/protocol';
import type { SessionDefinition } from '../shared/session';

import {
  createRuntimeInputState,
  resetRuntimeInputState,
  type RuntimeInputState
} from './RuntimeInputState';
import type { SimulationClock } from './SimulationClock';

export type SessionFlowSystem = Readonly<{
  start(session: SessionDefinition): void;
  stop(): void;
  pause(): void;
  resume(): void;
  handleInput(command: InputCommand): void;
  isActive(): boolean;
  activeSession(): SessionDefinition | null;
  inputState(): RuntimeInputState;
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
  const input = createRuntimeInputState();

  function start(next: SessionDefinition): void {
    if (session !== null) {
      log.warn('startSession ignored: a session is already active', {
        activeId: session.id,
        attemptedId: next.id
      });
      return;
    }
    session = next;
    resetRuntimeInputState(input, next.player.position.x, next.player.position.y);
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
    resetRuntimeInputState(input, 0, 0);
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

  function handleInput(command: InputCommand): void {
    if (session === null) {
      log.warn('input command ignored: no active session');
      return;
    }
    switch (command.kind) {
      case 'move':
        input.moveDir.dx = command.dx;
        input.moveDir.dy = command.dy;
        return;
      case 'aim':
        input.aimWorld.x = command.x;
        input.aimWorld.y = command.y;
        return;
      case 'fire':
        input.firing = command.phase === 'start';
        return;
      default:
        assertNever(command);
    }
  }

  return {
    start,
    stop,
    pause,
    resume,
    handleInput,
    isActive: () => session !== null,
    activeSession: () => session,
    inputState: () => input
  };
}
